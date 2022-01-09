<?php
$res = [];
try {
  header('Content-Type: text/plain; charset=utf-8');

  $req = isset($_REQUEST['q']) ? rawurldecode($_REQUEST['q']) : null;
  $req = json_decode($req, true);
  if (!$req)
    throw new ErrorException('JSON request error', 400);

  require('conf.php');
  $db = @mysqli_connect(HOSTNAME, USERNAME, PASSWORD, DATABASE);
  if (!$db)
    throw new ErrorException(mysqli_connect_error(), 503);
  mysqli_set_charset($db, 'utf8');
  
  require('functions.php');
  $session = isset($_REQUEST['s']) ? (int)$_REQUEST['s'] : 0;
  $api = new API($db, $session);
  $response = null;
  if ($_SERVER['REQUEST_METHOD'] === 'POST')
    $response = new Poster($api);
  else
    $response = new Getter($api);

  require('langs.php');

  foreach ($req as $input) {
    $out = null;
    $func = isset($input['func']) ? $input['func'] : '';
    if ($func and is_callable(array($response, $func)))
      $out = $response->$func($input);
    if ($out === null)
      throw new ErrorException('Misdirected Request', 421);
    $res[] = $out;
  }
  
  mysqli_close($db);
}

catch (ErrorException $e) {
  $code = $e->GetCode();
  if (!$code)
    $code = 400;
  $msg = $e->GetMessage();
  http_response_code($code);
  if ($code >= 500)
    error_log($msg."\r\n", 3, '../cache/error.log');
  $res = [$msg];
}
echo json_encode($res);