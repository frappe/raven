#!/bin/bash
set -e

echo "Setting Up System Dependencies..."

sudo apt update
sudo apt remove mysql-server mysql-client
sudo apt install libcups2-dev redis-server mariadb-client

wkhtmltopdf_dir="$(mktemp -d)"
trap 'rm -rf "$wkhtmltopdf_dir"' EXIT
wget -q -O "$wkhtmltopdf_dir/wkhtmltox.tar.xz" \
  https://github.com/frappe/wkhtmltopdf/raw/master/wkhtmltox-0.12.3_linux-generic-amd64.tar.xz
tar -xf "$wkhtmltopdf_dir/wkhtmltox.tar.xz" -C "$wkhtmltopdf_dir"
sudo install -m 0755 "$wkhtmltopdf_dir/wkhtmltox/bin/wkhtmltopdf" /usr/local/bin/wkhtmltopdf
wkhtmltopdf --version
