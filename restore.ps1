param (
    [Parameter()]
    [string]$filename,

    [Parameter()]
    [switch]$help,

    [Parameter()]
    [switch]$env,

    [Parameter()]
    [switch]$docker,

    [Parameter()]
    [switch]$remove,

    [Parameter()]
    [switch]$removetar
)

if ($help.IsPresent) {
    Write-Host "Usage: restore.ps1 [-filename] [-env] [-docker] [-remove] [-removetar]"
    exit
}

Write-Host " ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄▄▄ "
Write-Host "▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌"
Write-Host "▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀▀▀ ▐░█▀▀▀▀▀▀▀▀▀  ▀▀▀▀█░█▀▀▀▀ ▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀█░▌▐░█▀▀▀▀▀▀▀▀▀ "
Write-Host "▐░▌       ▐░▌▐░▌          ▐░▌               ▐░▌     ▐░▌       ▐░▌▐░▌       ▐░▌▐░▌          "
Write-Host "▐░█▄▄▄▄▄▄▄█░▌▐░█▄▄▄▄▄▄▄▄▄ ▐░█▄▄▄▄▄▄▄▄▄      ▐░▌     ▐░▌       ▐░▌▐░█▄▄▄▄▄▄▄█░▌▐░█▄▄▄▄▄▄▄▄▄ "
Write-Host "▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌     ▐░▌     ▐░▌       ▐░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌"
Write-Host "▐░█▀▀▀▀█░█▀▀ ▐░█▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀█░▌     ▐░▌     ▐░▌       ▐░▌▐░█▀▀▀▀█░█▀▀ ▐░█▀▀▀▀▀▀▀▀▀ "
Write-Host "▐░▌     ▐░▌  ▐░▌                    ▐░▌     ▐░▌     ▐░▌       ▐░▌▐░▌     ▐░▌  ▐░▌          "
Write-Host "▐░▌      ▐░▌ ▐░█▄▄▄▄▄▄▄▄▄  ▄▄▄▄▄▄▄▄▄█░▌     ▐░▌     ▐░█▄▄▄▄▄▄▄█░▌▐░▌      ▐░▌ ▐░█▄▄▄▄▄▄▄▄▄ "
Write-Host "▐░▌       ▐░▌▐░░░░░░░░░░░▌▐░░░░░░░░░░░▌     ▐░▌     ▐░░░░░░░░░░░▌▐░▌       ▐░▌▐░░░░░░░░░░░▌"
Write-Host " ▀         ▀  ▀▀▀▀▀▀▀▀▀▀▀  ▀▀▀▀▀▀▀▀▀▀▀       ▀       ▀▀▀▀▀▀▀▀▀▀▀  ▀         ▀  ▀▀▀▀▀▀▀▀▀▀▀ "

if ($null -eq $filename -or $filename -eq "") {
    Write-Host "Please specify the backup file. backup-*.tar.gz"
    exit
}

if (Test-Path $filename) {
    if (Test-Path backup) {
        Write-Host "The backup directory already exists. Do you want to overwrite it? (y/n)"
        $answer = Read-Host

        if ($answer -in "Y", "y", "Yes", "YES", "yes") {
            Remove-Item -Recurse -Force backup
            Write-Host "Removed the backup directory."
        } else {
            Write-Host "Exiting..."
            exit
        }
    }

    tar -xzvf $filename
    Write-Host "The file has been uncompressed."
    Write-Host "Shutting down traefik..."
    docker compose start traefik

    Write-Host "Restoring the database..."
    Get-Content backup\dump.sql | docker compose exec -T mariadb sh -c 'exec mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD"'

    Write-Host "Restoring the files..."
    $appwrite_volumes = @("uploads", "cache", "config", "certificates", "functions")

    foreach ($volume in $appwrite_volumes) {
        Write-Host "Restoring $volume..."
        docker run --rm --volumes-from "$(docker compose ps -q appwrite)" -v $PWD/backup:/restore ubuntu bash -c "cd /storage/$volume && tar xvf /restore/$volume.tar --strip 1"
    }

    if (-not($env.IsPresent)) {
        Write-Host "Do you want to restore the .env file? (y/n)"
        $answer = Read-Host
    } else {
        $answer = "y"
    }

    if ($answer -in "Y", "y", "Yes", "YES", "yes") {
        Write-Host "Restoring .env..."
        Copy-Item backup\.env .\.env
    }

    if (-not($docker.IsPresent)) {
        Write-Host "Do you want to restore the docker-compose.yml file? (y/n)"
        $answer = Read-Host
    } else {
        $answer = "y"
    }

    if ($answer -in "Y", "y", "Yes", "YES", "yes") {
        Write-Host "Restoring docker-compose.yml..."
        Copy-Item backup\docker-compose.yml .\docker-compose.yml
    }

    if (-not($remove.IsPresent)) {
        Write-Host "Do you want to remove the backup files? (y/n)"
        $answer = Read-Host
    } else {
        $answer = "y"
    }

    if ($answer -in "Y", "y", "Yes", "YES", "yes") {
        Remove-Item -Recurse -Force backup
        Write-Host "Removed the backup directory."
    }

    if (-not($removetar.IsPresent)) {
        Write-Host "Do you want to remove the compressed file? (y/n)"
        $answer = Read-Host
    } else {
        $answer = "y"
    }
    
    if ($answer -in "Y", "y", "Yes", "YES", "yes") {
        Remove-Item -Recurse -Force $filename
        Write-Host "Removed the compressed file."
    }

    Write-Host "Starting traefik..."
    docker compose start traefik

    Write-Host "Successfully restored the backup."

} else {
    Write-Host "The file does not exist."
}
