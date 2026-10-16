use base64::{Engine, engine::general_purpose::STANDARD};
use minisign_verify::{PublicKey, Signature};
use std::{env, fs};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest_path = env::args().nth(1).expect("Pass latest.json path");
    let manifest: serde_json::Value = serde_json::from_slice(&fs::read(&manifest_path)?)?;
    let config: serde_json::Value = serde_json::from_str(include_str!("../tauri.conf.json"))?;
    let platform = &manifest["platforms"]["windows-x86_64"];
    let decode = |value: &serde_json::Value| -> Result<String, Box<dyn std::error::Error>> {
        Ok(String::from_utf8(
            STANDARD.decode(value.as_str().ok_or("Missing value")?)?,
        )?)
    };
    let key = PublicKey::decode(&decode(&config["plugins"]["updater"]["pubkey"])?)?;
    let signature_text = decode(&platform["signature"])?;
    let signature = Signature::decode(&signature_text)?;
    let filename = platform["url"]
        .as_str()
        .ok_or("Missing URL")?
        .rsplit('/')
        .next()
        .unwrap();
    let mut bytes = fs::read(
        std::path::Path::new(&manifest_path)
            .parent()
            .unwrap()
            .join(filename),
    )?;
    key.verify(&bytes, &signature, true)?;
    let signed_version = signature
        .trusted_comment()
        .split('\t')
        .find_map(|s| s.strip_prefix("version:"));
    assert_eq!(
        signed_version,
        manifest["version"].as_str(),
        "Version must be covered by the signature"
    );
    bytes[100] ^= 1;
    assert!(
        key.verify(&bytes, &signature, true).is_err(),
        "Modified installer must be rejected"
    );
    println!("PASS: actual installer signature, signed version, and tampered-installer rejection");
    Ok(())
}
