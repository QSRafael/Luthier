pub fn dry_run_enabled() -> bool {
    std::env::var("LUTHIER_DRY_RUN")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false)
}
