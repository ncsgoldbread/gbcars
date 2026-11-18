<?php
// Copy this file to config/config.php and edit the values.
// config/config.php is ignored by git so passwords never reach GitHub.
return [
    'db' => [
        'host'     => '127.0.0.1',
        'port'     => 3306,
        'name'     => 'gbcars',
        'user'     => 'root',
        'pass'     => '',
        'charset'  => 'utf8mb4',
    ],
    // Folder that holds uploaded files: car/, driver/, user/, booking/
    // Copy the old F:\Project\gbcarsys\fileupload\* here.
    'upload_dir' => __DIR__ . '/../uploads',
    'max_upload_mb' => 20,
    'timezone' => 'Asia/Bangkok',
    // Must match the old system so old passwords keep working (they are upgraded to bcrypt on login).
    'legacy_salt' => 'carsys12348',
    // Set true only during development.
    'debug' => false,
];
