<?php
/**
 * PORTO 2026 MOBILE — SERVER SYNC ENDPOINT
 * Safely receives the encrypted database from the PWA admin panel and writes it to disk.
 */
header('Content-Type: application/json');

// 1. Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

// 2. Read raw JSON payload
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!isset($data['fileData'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Payload has no fileData']);
    exit;
}

$encContent = $data['fileData'];

// 3. Lightweight verification of the database structure to prevent corruption
$parsed = json_decode($encContent, true);
if (!$parsed || !isset($parsed['keysTable']) || !isset($parsed['payloadCt'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid Encryption File Format']);
    exit;
}

// 4. Save the file to the server disk
$targetPath = __DIR__ . '/porto2026_mobile.enc';
$success = file_put_contents($targetPath, $encContent);

if ($success === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Failed to write to disk. Check folder write permissions.']);
    exit;
}

echo json_encode(['success' => true, 'message' => 'Escalas sync completada no servidor.']);
