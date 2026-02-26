mod config;
mod doctor;
mod play;
mod show_config;
mod winecfg;

pub use config::run_config_command;
pub use doctor::run_doctor_command;
pub use play::run_play;
pub use show_config::run_show_embedded_config;
pub use winecfg::run_winecfg_command;
