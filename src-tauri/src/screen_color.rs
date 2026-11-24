use std::thread::sleep;
use std::time::Duration;

const POLL_INTERVAL: Duration = Duration::from_millis(8);
const GRID_SIZE: i32 = 11;

#[cfg(windows)]
pub fn pick(
    on_move: impl Fn(i32, i32),
    on_pixels: impl Fn(&str),
) -> Result<Option<String>, String> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
        GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
        SRCCOPY,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE, VK_LBUTTON};
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;

    fn is_down(key: u16) -> bool {
        unsafe { GetAsyncKeyState(key as i32) as u16 & 0x8000 != 0 }
    }

    let cell_count = (GRID_SIZE * GRID_SIZE) as usize;
    let half = GRID_SIZE / 2;

    unsafe {
        let screen = GetDC(std::ptr::null_mut());
        let memory = CreateCompatibleDC(screen);
        let bitmap = CreateCompatibleBitmap(screen, GRID_SIZE, GRID_SIZE);
        let previous = SelectObject(memory, bitmap);

        let mut info: BITMAPINFO = std::mem::zeroed();
        info.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        info.bmiHeader.biWidth = GRID_SIZE;
        info.bmiHeader.biHeight = -GRID_SIZE;
        info.bmiHeader.biPlanes = 1;
        info.bmiHeader.biBitCount = 32;
        info.bmiHeader.biCompression = BI_RGB;

        let mut raw = vec![0u8; cell_count * 4];
        let mut last_pixels = String::new();
        let mut last_point = (i32::MIN, i32::MIN);

        while is_down(VK_LBUTTON) {
            sleep(POLL_INTERVAL);
        }

        let outcome = loop {
            if is_down(VK_ESCAPE) {
                break Ok(None);
            }

            let mut point = POINT { x: 0, y: 0 };
            if GetCursorPos(&mut point) == 0 {
                break Err("Could not read the cursor position".to_string());
            }

            BitBlt(
                memory,
                0,
                0,
                GRID_SIZE,
                GRID_SIZE,
                screen,
                point.x - half,
                point.y - half,
                SRCCOPY,
            );
            GetDIBits(
                memory,
                bitmap,
                0,
                GRID_SIZE as u32,
                raw.as_mut_ptr().cast(),
                &mut info,
                DIB_RGB_COLORS,
            );

            let mut pixels = String::with_capacity(cell_count * 6);
            for chunk in raw.chunks_exact(4) {
                pixels.push_str(&format!("{:02x}{:02x}{:02x}", chunk[2], chunk[1], chunk[0]));
            }

            if is_down(VK_LBUTTON) {
                let center = cell_count / 2 * 6;
                let color = format!("#{}", &pixels[center..center + 6]);
                while is_down(VK_LBUTTON) {
                    sleep(POLL_INTERVAL);
                }
                break Ok(Some(color));
            }

            if (point.x, point.y) != last_point {
                on_move(point.x, point.y);
                last_point = (point.x, point.y);
            }
            if pixels != last_pixels {
                on_pixels(&pixels);
                last_pixels = pixels;
            }

            sleep(POLL_INTERVAL);
        };

        SelectObject(memory, previous);
        DeleteObject(bitmap);
        DeleteDC(memory);
        ReleaseDC(std::ptr::null_mut(), screen);
        outcome
    }
}

#[cfg(not(windows))]
pub fn pick(
    _on_move: impl Fn(i32, i32),
    _on_pixels: impl Fn(&str),
) -> Result<Option<String>, String> {
    Err("Screen colour picking is only available on Windows".into())
}
