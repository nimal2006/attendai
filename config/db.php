<?php
$host     = getenv('DB_HOST');
$username = getenv('DB_USER');
$password = getenv('DB_PASS');
$database = getenv('DB_NAME');
$port     = getenv('DB_PORT') ?: 3306;

$conn = mysqli_init();
mysqli_ssl_set($conn, NULL, NULL, NULL, NULL, NULL);
mysqli_real_connect(
    $conn,
    $host, $username, $password, $database,
    (int)$port, NULL, MYSQLI_CLIENT_SSL
);

if (!$conn) {
    die("Connection failed: " . mysqli_connect_error());
}
?>
<?php
require_once 'config/db.php';
// now use $conn for queries
?>
