<?php
try
{
  require('fields.php');
  require('langs.php');
  
  $api = array
  (
    'get_text'=>['GET','id','fields','langs','limit'],
    'get_users'=>['GET','id','fields','limit'],
    'get_stats'=>['GET','id'],
    'get_path'=>['GET','id'],
    'set_text'=>['POST','id','lang','string'],
    'append_term'=>['POST','id','label'],
    'set_label'=>['POST','id','label'],
    'delete_terms'=>['POST','ids'],
    'group_terms'=>['POST','ids'],
    'auth_login'=>['GET','url'],
    'auth_logout'=>['POST'],
    'auth_status'=>['GET','id'],
    'export_text'=>['GET','id','langs','format','compact'],
    'export_zip'=>['GET','id','langs','format','compact'],
  );
  
  function validate($input, $expected)
  {
    global $fields, $langs;
    $out = null;
    $type = gettype($input);
    if ($type == 'string' or $type == 'integer')
    {
      if ($expected == 'id' or $expected == 'compact')
        $out = filter_var($input, FILTER_VALIDATE_INT);
      if ($expected == 'limit')
        $out = filter_var($input, FILTER_VALIDATE_INT);
      elseif ($expected == 'string')
        $out = filter_var($input, FILTER_DEFAULT);
      elseif ($expected == 'label' or $expected == 'format')
        $out = filter_var($input, FILTER_DEFAULT);
      elseif ($expected == 'url')
        $out = filter_var($input, FILTER_DEFAULT);
      elseif ($expected == 'lang')
        if (array_key_exists($input, $langs))
          $out = $input;
        else
          throw new ErrorException('Invalid value:lang');
    }
    elseif ($type == 'array')
    {
      $out = [];
      if ($expected == 'fields')
        foreach ($input as $v)
          if (array_key_exists($v, $fields))
            $out[] = $fields[$v];
          else
            throw new ErrorException('Invalid value in fields:'.$v);
      elseif ($expected == 'langs')
        foreach ($input as $v)
          if (array_key_exists($v, $langs))
            $out[] = $langs[$v];
          else
            throw new ErrorException('Invalid value in langs:'.$v);
      elseif ($expected == 'ids')
        foreach ($input as $v)
          $out[] = filter_var($v, FILTER_VALIDATE_INT);
      array_filter($out);
      if (count($out) != count($input))
        $out = null;
    }
    return $out;
  }

  header('Content-Type: text/plain; charset=utf-8');

  $req = (isset($_REQUEST['q']) ? rawurldecode($_REQUEST['q']) : null);
  $req = json_decode($req, true);
  if (!$req)
    throw new ErrorException('JSON request error', 400);
  
  require('functions.php');
  $db = db_connect();
  $res = [];
  $method = $_SERVER['REQUEST_METHOD'];
  $session = (isset($_REQUEST['s']) ? (int)$_REQUEST['s'] : 0);
  $user_id = 0;

  if ($session)
    $user_id = resume($db, $session);

  foreach ($req as $in)
  {
    $out = null;
    $func = (isset($in['func']) ? $in['func'] : '');
    if (array_key_exists($func, $api))
    {
      $params = $api[$func];
      if ($method == $params[0])
      {
        $args = [];
        for ($i = 1; $i < count($params); $i++)
        {
          $k = $params[$i];
          if (!isset($in[$k]))
            throw new ErrorException('Missing paramter:'.$k, 400);
          $input = validate($in[$k], $k);
          if ($input === null)
            throw new ErrorException('Validation failed:'.$k, 400);
          $args[] = $input;
        }
        array_unshift($args, $db);
        if ($params[0] == 'POST')
          array_push($args, $user_id);
        $out = call_user_func_array($func, $args);
      }
    }

    if ($out === null)
      throw new ErrorException('Misdirected Request', 421);
    $res[] = $out;
  }
  db_close($db);
}
catch (ErrorException $e)
{
  $code = $e->GetCode();
  if (!$code)
    $code = 400;
  $msg = $e->GetMessage();
  http_response_code($code);
  if ($code >= 500)
    error_log($msg."\r\n", 3, 'error.log');
  $res = [$msg];
}
  
echo json_encode($res);