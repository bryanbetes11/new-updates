#[cfg(not(target_os = "macos"))]
use tauri::{
    LogicalPosition, LogicalSize, Rect, WebviewBuilder, WebviewUrl, WindowBuilder, WindowEvent,
};
use tauri::{Url, webview::NewWindowResponse};
use tauri_plugin_opener::OpenerExt;

fn is_app_url(url: &Url, dev_origin: Option<&Url>) -> bool {
    if !url.username().is_empty() || url.password().is_some() {
        return false;
    }
    (url.scheme() == "http" && url.host_str() == Some("tauri.localhost") && url.port().is_none())
        || (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || dev_origin.is_some_and(|dev| url.origin() == dev.origin())
}

fn is_external_url(url: &Url) -> bool {
    url.username().is_empty()
        && url.password().is_none()
        && matches!(url.scheme(), "https" | "http" | "mailto" | "tel")
        && url.host_str() != Some("tauri.localhost")
}

fn open_external(app: &tauri::AppHandle, url: &Url) {
    if is_external_url(url) {
        // Attachment URLs can contain access tokens; do not log them.
        if app.opener().open_url(url.as_str(), None::<&str>).is_err() {
            eprintln!("Unable to open the external link in its default application.");
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .setup(|app| {
            let navigation_app = app.handle().clone();
            let popup_app = app.handle().clone();
            let dev_origin = if cfg!(dev) {
                app.config().build.dev_url.clone()
            } else {
                None
            };
            let window_config = app.config().app.windows[0].clone();
            #[cfg(target_os = "macos")]
            {
                // Native Mac controls keep the traffic lights and the standard
                // window lifecycle; the Windows caption stays Windows-only.
                tauri::WebviewWindowBuilder::from_config(app, &window_config)?
                    .decorations(true)
                    .disable_drag_drop_handler()
                    .on_navigation(move |url| {
                        if is_app_url(url, dev_origin.as_ref()) {
                            true
                        } else {
                            open_external(&navigation_app, url);
                            false
                        }
                    })
                    .on_new_window(move |url, _features| {
                        open_external(&popup_app, &url);
                        NewWindowResponse::Deny
                    })
                    .build()?;
            }
            #[cfg(not(target_os = "macos"))]
            {
                let mut builder = WindowBuilder::from_config(app, &window_config)?;
                if let Some(icon) = app.default_window_icon() {
                    builder = builder.icon(icon.clone())?;
                }
                let window = builder.build()?;
                let size = window
                    .inner_size()?
                    .to_logical::<f64>(window.scale_factor()?);
                // A separate caption view preserves the existing application's real
                // viewport: fixed headers, chat, dialogs and Live Mode need no offsets.
                let titlebar_origin = dev_origin.clone();
                let titlebar = window.add_child(
                    WebviewBuilder::new(
                        "titlebar",
                        WebviewUrl::App("desktop-titlebar.html".into()),
                    )
                    .on_navigation(move |url| is_app_url(url, titlebar_origin.as_ref())),
                    LogicalPosition::new(0.0, 0.0),
                    LogicalSize::new(size.width, 38.0),
                )?;
                let main = window.add_child(
                    WebviewBuilder::new("main", WebviewUrl::App("index.html".into()))
                        .disable_drag_drop_handler()
                        .on_navigation(move |url| {
                            if is_app_url(url, dev_origin.as_ref()) {
                                true
                            } else {
                                open_external(&navigation_app, url);
                                false
                            }
                        })
                        .on_new_window(move |url, _features| {
                            open_external(&popup_app, &url);
                            NewWindowResponse::Deny
                        }),
                    LogicalPosition::new(0.0, 38.0),
                    LogicalSize::new(size.width, (size.height - 38.0).max(1.0)),
                )?;
                let resize_window = window.clone();
                window.on_window_event(move |event| {
                    if matches!(
                        event,
                        WindowEvent::Resized(_) | WindowEvent::ScaleFactorChanged { .. }
                    ) {
                        if let (Ok(size), Ok(scale)) =
                            (resize_window.inner_size(), resize_window.scale_factor())
                        {
                            let size = size.to_logical::<f64>(scale);
                            let _ = titlebar.set_bounds(Rect {
                                position: LogicalPosition::new(0.0, 0.0).into(),
                                size: LogicalSize::new(size.width, 38.0).into(),
                            });
                            let _ = main.set_bounds(Rect {
                                position: LogicalPosition::new(0.0, 38.0).into(),
                                size: LogicalSize::new(size.width, (size.height - 38.0).max(1.0))
                                    .into(),
                            });
                        }
                    }
                });
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Unable to start ServeSync");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn packaged_navigation_stays_on_its_own_origin() {
        for allowed in [
            "http://tauri.localhost/",
            "http://tauri.localhost/events/123",
            "tauri://localhost/settings",
        ] {
            assert!(is_app_url(&Url::parse(allowed).unwrap(), None));
        }
        for denied in [
            "https://example.com",
            "http://tauri.localhost.evil.test",
            "http://tauri.localhost:5175",
            "http://user@tauri.localhost",
            "file:///C:/Windows/win.ini",
            "http://127.0.0.1:5175",
        ] {
            assert!(!is_app_url(&Url::parse(denied).unwrap(), None));
        }
        let dev = Url::parse("http://127.0.0.1:5175").unwrap();
        assert!(is_app_url(
            &Url::parse("http://127.0.0.1:5175/login").unwrap(),
            Some(&dev)
        ));
        assert!(!is_app_url(
            &Url::parse("http://127.0.0.1:5176/login").unwrap(),
            Some(&dev)
        ));
    }
    #[test]
    fn external_links_cannot_launch_files_or_arbitrary_protocols() {
        for allowed in [
            "https://example.com/file.pdf",
            "mailto:hello@example.com",
            "tel:+123456789",
        ] {
            assert!(is_external_url(&Url::parse(allowed).unwrap()));
        }
        for denied in [
            "file:///C:/Windows/System32/cmd.exe",
            "javascript:alert(1)",
            "data:text/html,test",
            "ms-settings:privacy",
            "https://user:pass@example.com",
            "http://tauri.localhost/login",
        ] {
            assert!(!is_external_url(&Url::parse(denied).unwrap()));
        }
    }
}
