#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
pkg_dir="${project_root}/pkgconfig"
shim_dir="${project_root}/libshims"

if ! command -v pkg-config >/dev/null 2>&1; then
  echo "pkg-config is required to build the Tauri app on Linux." >&2
  exit 1
fi

for module in javascriptcoregtk-4.1 webkit2gtk-4.1; do
  if ! pkg-config --exists "${module}"; then
    echo "missing pkg-config module: ${module}" >&2
    exit 1
  fi
done

libdir="$(pkg-config --variable=libdir webkit2gtk-4.1)"
includedir="$(pkg-config --variable=includedir webkit2gtk-4.1)"
version="$(pkg-config --modversion webkit2gtk-4.1)"

jsc_target="${libdir}/libjavascriptcoregtk-4.1.so"
webkit_target="${libdir}/libwebkit2gtk-4.1.so"

if [[ ! -f "${jsc_target}" ]]; then
  echo "missing shared library: ${jsc_target}" >&2
  exit 1
fi

if [[ ! -f "${webkit_target}" ]]; then
  echo "missing shared library: ${webkit_target}" >&2
  exit 1
fi

mkdir -p "${pkg_dir}" "${shim_dir}"

cat > "${pkg_dir}/javascriptcoregtk-4.0.pc" <<PC_EOF
prefix=/usr
exec_prefix=\${prefix}
libdir=${libdir}
includedir=${includedir}
revision=compat-shim

Name: JavaScriptCoreGTK+
Description: Compatibility shim mapping javascriptcoregtk-4.0 to javascriptcoregtk-4.1
Version: ${version}
Requires: glib-2.0 gobject-2.0
Libs: -L\${libdir} -ljavascriptcoregtk-4.1
Cflags: -I\${includedir}/webkitgtk-4.1
PC_EOF

cat > "${pkg_dir}/webkit2gtk-4.0.pc" <<PC_EOF
prefix=/usr
exec_prefix=\${prefix}
libdir=${libdir}
includedir=${includedir}
revision=compat-shim

Name: WebKitGTK
Description: Compatibility shim mapping webkit2gtk-4.0 to webkit2gtk-4.1
URL: https://webkitgtk.org
Version: ${version}
Requires: glib-2.0 gtk+-3.0 libsoup-3.0 javascriptcoregtk-4.0
Libs: -L\${libdir} -lwebkit2gtk-4.1
Cflags: -I\${includedir}/webkitgtk-4.1
PC_EOF

cat > "${pkg_dir}/webkit2gtk-web-extension-4.0.pc" <<PC_EOF
prefix=/usr
exec_prefix=\${prefix}
libdir=${libdir}
includedir=${includedir}
revision=compat-shim

Name: WebKitGTK web process extensions
Description: Compatibility shim mapping webkit2gtk-web-extension-4.0 to 4.1
URL: https://webkitgtk.org
Version: ${version}
Requires: glib-2.0 gtk+-3.0 libsoup-3.0 javascriptcoregtk-4.0
Libs: -L\${libdir} -lwebkit2gtk-4.1
Cflags: -I\${includedir}/webkitgtk-4.1
PC_EOF

ln -sf "${jsc_target}" "${shim_dir}/libjavascriptcoregtk-4.0.so"
ln -sf "${webkit_target}" "${shim_dir}/libwebkit2gtk-4.0.so"
