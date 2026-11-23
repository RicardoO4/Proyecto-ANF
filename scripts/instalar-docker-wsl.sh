#!/bin/sh
# Ejecutar como root dentro de Ubuntu 24.04 en WSL2. Sin Docker Desktop.
set -eu
apt-get update -qq
apt-get install -y --no-install-recommends ca-certificates curl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
printf '%s\n' 'Types: deb' 'URIs: https://download.docker.com/linux/ubuntu' 'Suites: noble' 'Components: stable' 'Architectures: amd64' 'Signed-By: /etc/apt/keyrings/docker.asc' > /etc/apt/sources.list.d/docker.sources
apt-get update -qq
apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
service docker start
curl -fsSL https://github.com/supabase/cli/releases/download/v3.2.0/supabase_linux_amd64.tar.gz -o /tmp/anf-supabase.tar.gz
tar -xzf /tmp/anf-supabase.tar.gz -C /usr/local/bin supabase
rm /tmp/anf-supabase.tar.gz
apt-get clean
docker version
supabase --version
