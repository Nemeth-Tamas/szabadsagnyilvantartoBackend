
Write-Host " ▄▄▄▄▄▄▄▄▄▄   ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄    ▄  ▄         ▄  ▄▄▄▄▄▄▄▄▄▄▄ "
Write-Host "▐░░░░░░░░░░▌ ▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░▌  ▐░▌▐░▌       ▐░▌▐░░░░░░░░░░░▌"
Write-Host "▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀▀▀ ▐░▌ ▐░▌ ▐░▌       ▐░▌▐░█▀▀▀▀▀▀▀█░▌"
Write-Host "▐░▌       ▐░▌▐░▌       ▐░▌▐░▌          ▐░▌▐░▌  ▐░▌       ▐░▌▐░▌       ▐░▌"
Write-Host "▐░█▄▄▄▄▄▄▄█░▌▐░█▄▄▄▄▄▄▄█░▌▐░▌          ▐░▌░▌   ▐░▌       ▐░▌▐░█▄▄▄▄▄▄▄█░▌"
Write-Host "▐░░░░░░░░░░▌ ▐░░░░░░░░░░░▌▐░▌          ▐░░▌    ▐░▌       ▐░▌▐░░░░░░░░░░░▌"
Write-Host "▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌▐░▌          ▐░▌░▌   ▐░▌       ▐░▌▐░█▀▀▀▀▀▀▀▀▀ "
Write-Host "▐░▌       ▐░▌▐░▌       ▐░▌▐░▌          ▐░▌▐░▌  ▐░▌       ▐░▌▐░▌          "
Write-Host "▐░█▄▄▄▄▄▄▄█░▌▐░▌       ▐░▌▐░█▄▄▄▄▄▄▄▄▄ ▐░▌ ▐░▌ ▐░█▄▄▄▄▄▄▄█░▌▐░▌          "
Write-Host "▐░░░░░░░░░░▌ ▐░▌       ▐░▌▐░░░░░░░░░░░▌▐░▌  ▐░▌▐░░░░░░░░░░░▌▐░▌          "
Write-Host " ▀▀▀▀▀▀▀▀▀▀   ▀         ▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀    ▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀           "

Write-Host "Are you sure you want to shut down traefic and start the backup? (y/n)"
$answer = Read-Host

if ($answer -in "Y", "y", "Yes", "YES", "yes") {
    Write-Host "Shutting down traefik..."
    docker compose start traefik

    Write-Host "Creating backup folder..."
    mkdir -p backup

    Write-Host "Creating dump of mariadb..."
    docker compose exec mariadb sh -c 'exec mysqldump --all-databases --add-drop-database -u"$MYSQL_USER" -p"$MYSQL_PASSWORD"' > ./backup/dump.sql

    Write-Host "Creating backup of .env..."
    Copy-Item .env ./backup/.env

    Write-Host "Creating backup of docker-compose.yml..."
    Copy-Item docker-compose.yml ./backup/docker-compose.yml

    Write-Host "Creating backup of directories..."
    $appwrite_volumes = @("uploads", "cache", "config", "certificates", "functions")

    foreach ($volume in $appwrite_volumes) {
        Write-Host "Creating backup of $volume..."
        docker run --rm --volumes-from "$(docker compose ps -q appwrite)" -v $PWD/backup:/backup ubuntu bash -c "cd /storage/$volume && tar cvf /backup/$volume.tar ."
    }

    Write-Host "Compressing backup..."
    $date = Get-Date -Format "yyyy-MM-dd"
    tar -czvf "backup-$date.tar.gz" backup

    Write-Host "Cleaning up..."
    Remove-Item -Recurse -Force backup

    Write-Host "Starting traefik..."
    docker compose start traefik
} else {
    Write-Host "Exiting..."
    exit
}