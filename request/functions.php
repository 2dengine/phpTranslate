<?php

require('conf.php');

function db_connect()
{
  $db = @mysqli_connect(HOSTNAME, USERNAME, PASSWORD, DATABASE);
  if (!$db)
    throw new ErrorException(mysqli_connect_error(), 503);
  mysqli_set_charset($db, 'utf8');
  return $db;
}

function db_close($db)
{
  mysqli_close($db);
}

function db_query($db, $sql)
{
  $res = mysqli_query($db, $sql);
  if (!$res)
    throw new ErrorException(mysqli_error($db), 500);
  return $res;
}

function get_terms($db, $ids, $owner_id = 0)
{
  if (!is_array($ids))
    $ids = [$ids];
  $count = count($ids);
  $set = implode(',', $ids);
  $res = db_query($db, "SELECT id, parent_id, label, owner_id
    FROM `terms` AS t
    WHERE id IN ($set)
      AND (owner_id = $owner_id
      OR $owner_id = 0)");
  if (mysqli_num_rows($res) != $count or $count == 0)
    throw new ErrorException('Forbidden', 403);
  $rows = mysqli_fetch_all($res, MYSQLI_ASSOC);
  if ($count == 1)
    return $rows = $rows[0];
  return $rows;
}

function get_path($db, $id)
{
  $path = [];
  while ($id and $parent = get_terms($db, $id))
  {
    array_unshift($path, $parent);
    $id = $parent['parent_id'];
  }
  return $path;
}

function append_term($db, $parent_id, $label, $owner_id)
{
  if (!$owner_id)
    throw new ErrorException('Unauthorized', 401);
  if ($parent_id > 0 and $owner_id != 1)
    get_terms($db, $parent_id, $owner_id);
  $label = mysqli_real_escape_string($db, $label);
  db_query($db, "INSERT INTO `terms`
    (`parent_id`, `label`, `owner_id`)
    VALUES ($parent_id, '$label', $owner_id)");
  return mysqli_insert_id($db);
}

function delete_terms($db, $ids, $owner_id)
{
  if (!$owner_id)
    throw new ErrorException('Unauthorized', 401);
  if (!is_array($ids))
    $ids = [$ids];
  if ($owner_id != 1)
    get_terms($db, $ids, $owner_id);
  // remove from db
  $set = implode(',', $ids);
  db_query($db, "DELETE FROM `terms`
    WHERE id IN ($set)");
  // remove sub-items
  while (mysqli_affected_rows($db) > 0)
    db_query($db, "DELETE a FROM `terms` a
      RIGHT JOIN `terms` b
        ON a.parent_id = b.id
      WHERE ISNULL(b.id)");
  return true;
}

function delete_me($db, $owner_id) {
  if (!$owner_id || $owner_id == 1)
    throw new ErrorException('Unauthorized', 401);
  db_query($db, "DELETE FROM `revisions` WHERE poster_id = $owner_id");
  db_query($db, "DELETE FROM `users` WHERE user_id = $owner_id");
  return true;
}

function group_terms($db, $ids, $owner_id)
{
  if (!$owner_id)
    throw new ErrorException('Unauthorized', 401);
  $parent_id = array_shift($ids);
  if (in_array($parent_id, $ids))
    throw new ErrorException('Term cannot be parented by itself', 400);
  $terms = get_terms($db, $ids, $owner_id);
  $parent = get_terms($db, $parent_id, $owner_id);
  $ids = implode(',', $ids);
  db_query($db, "UPDATE `terms`
    SET parent_id = {$parent['id']}
    WHERE id IN ($ids)
      AND parent_id = {$parent['parent_id']}");
  return true;
}

function get_found_rows($db)
{
  $res = db_query($db, "SELECT FOUND_ROWS()");
  return mysqli_fetch_row($res)[0];
}

function get_text($db, $id, $fields, $langs, $limit = 10000, $offset = 0)
{
  $fields = implode(',', $fields);
  $langs = implode(',', $langs);
  $res = db_query($db, 
  "SELECT SQL_CALC_FOUND_ROWS $fields
    FROM `terms` AS t
    LEFT JOIN `revisions` AS r
      ON r.term_id = t.id
      AND r.locale IN ($langs)
    LEFT OUTER JOIN `revisions` AS r2
      ON (r.term_id = r2.term_id)
      AND (r.locale = r2.locale)
      AND (r.posted < r2.posted)
    LEFT JOIN `users` u
      ON r.poster_id = u.user_id
    WHERE
      ISNULL(r2.posted)
      AND (t.id = $id OR t.parent_id = $id)
    ORDER BY FIELD(t.id, $id) DESC, t.id ASC
    LIMIT $limit OFFSET $offset");
  return mysqli_fetch_all($res, MYSQLI_ASSOC);
}

function set_approved($db, $ids, $langs, $approved, $owner_id = 0)
{
  if ($owner_id != 1)
    throw new ErrorException('Unauthorized', 401);
  if (!is_array($ids))
    $ids = [$ids];
  $set = implode(',', $ids);
  $langs = implode(',', $langs);
  $status = ($approved) ? 'TRUE' : 'FALSE';
  db_query($db, "UPDATE `revisions` AS r
    LEFT OUTER JOIN `revisions` AS r2
      ON (r.term_id = r2.term_id)
      AND (r.locale = r2.locale)
      AND (r.posted < r2.posted)
    SET
      r.approved = $status
    WHERE
      ISNULL(r2.posted)
      AND r.term_id IN ($set)
      AND r.locale IN ($langs)");
  return true;
}

function set_label($db, $id, $label, $poster_id)
{
  if (!$poster_id)
    throw new ErrorException('Unauthorized', 401);
  get_terms($db, $id, $poster_id);
  $label = mysqli_real_escape_string($db, $label);
  db_query($db, "UPDATE `terms`
    SET label = '$label'
    WHERE id = '$id'");
  return true;
}

function set_text($db, $id, $lang, $string, $poster_id)
{
  if (!$poster_id)
    throw new ErrorException('Unauthorized', 401);
  $string = mysqli_real_escape_string($db, $string);
  $poster_ip = mysqli_real_escape_string($db, $_SERVER['REMOTE_ADDR']);
  db_query($db,
  "INSERT INTO `revisions`
    (term_id, locale, string, poster_id, poster_ip)
    VALUES
    ($id, '$lang', '$string', $poster_id, INET6_ATON('$poster_ip'))");
  return true;
}

function set_consent($db, $on, $owner_id)
{
  $bool = ($on) ? 'TRUE' : 'FALSE';
  db_query($db, "UPDATE `users` SET consent = $bool, consent_stamp = NOW() WHERE user_id = $owner_id");
  return true;
}

function set_credit($db, $on, $owner_id)
{
  $bool = ($on) ? 'TRUE' : 'FALSE';
  db_query($db, "UPDATE `users` SET credit = $bool, credit_stamp = NOW() WHERE user_id = $owner_id");
  return true;
}

function set_name($db, $string, $owner_id)
{
  db_query($db, "UPDATE `users` SET name = '$string' WHERE user_id = $owner_id");
  return true;
}

function get_users($db, $id, $fields, $limit = 10000, $offset = 0)
{
  $fields = implode(',', $fields);
  $res = db_query($db,
  "SELECT $fields
    FROM `users` AS u
    WHERE user_id = $id
      OR $id = 0
    LIMIT $limit OFFSET $offset");
  return mysqli_fetch_all($res, MYSQLI_ASSOC);
}

function get_stats($db, $id)
{
  $res = db_query($db, "SELECT r.locale,
      COUNT(r.term_id) AS count,
      UNIX_TIMESTAMP(MAX(r.posted)) AS updated
    FROM `terms`
    LEFT JOIN `revisions` AS r
      ON r.term_id = id
    LEFT OUTER JOIN `revisions` AS r2
      ON r.term_id = r2.term_id
      AND r.locale = r2.locale
      AND r.posted < r2.posted
    WHERE
      ISNULL(r2.posted)
      AND (id = $id OR parent_id = $id)
    GROUP BY r.locale
    ORDER BY FIELD(r.locale, 'en') DESC, count DESC, updated DESC");
  return mysqli_fetch_all($res, MYSQLI_ASSOC);
}

function login($db, $user_id)
{
  if (!$user_id) return 0;
  $user_ip = mysqli_real_escape_string($db, $_SERVER['REMOTE_ADDR']);
  $session = rand();
  db_query($db, "UPDATE `users`
    SET session = '$session',
      user_ip = INET6_ATON('$user_ip'),
      lastactive = NOW()
    WHERE user_id = $user_id");
  $res = db_query($db, "SELECT session FROM `users`
    WHERE user_id = $user_id");
  if (!$res or !mysqli_num_rows($res))
    return 0;
  $row = mysqli_fetch_assoc($res);
  return $row['session'];
}

function logout($db, $user_id)
{
  $res = db_query($db, "UPDATE `users`
    SET session = NULL
    WHERE user_id = $user_id");
  if (!$res or !mysqli_affected_rows($res))
    return false;
  return true;
}

function resume($db, $session)
{
  $session = mysqli_real_escape_string($db, $session);
  $user_ip = mysqli_real_escape_string($db, $_SERVER['REMOTE_ADDR']);
  $res = db_query($db, "SELECT user_id
    FROM `users`
    WHERE session = '$session'
      AND user_ip = INET6_ATON('$user_ip')");
  if (!$res or !mysqli_num_rows($res))
    return 0;
  $row = mysqli_fetch_assoc($res);
  return $row['user_id'];
}

function register($db, $username, $steam_id, $avatar)
{
  $username = mysqli_real_escape_string($db, $username);
  $steam_id = mysqli_real_escape_string($db, $steam_id);
  $user_ip = mysqli_real_escape_string($db, $_SERVER['REMOTE_ADDR']);
  $avatar = mysqli_real_escape_string($db, $avatar);
  db_query($db, "INSERT INTO `users`
      (username, steam_id, user_ip, joined, avatar)
    VALUES
      ('$username', '$steam_id', INET6_ATON('$user_ip'), NOW(), '$avatar')
    ON DUPLICATE KEY
      UPDATE username = '$username', lastactive = NOW(), avatar = '$avatar'");
  $res = db_query($db, "SELECT user_id FROM `users`
    WHERE steam_id = '$steam_id'");
  $row = mysqli_fetch_assoc($res);
  return $row['user_id'];
}

function auth_login($db, $redirect)
{
  require_once('openid.php');
  $openid = new LightOpenID(AUTH_DOMAIN);
  if (!$openid->mode)
  {
    $openid->identity = AUTH_IDENTITY;
    return $openid->authUrl();
  }
  elseif ($openid->mode != 'cancel' and $openid->validate())
  { 
    $id = $openid->identity;
    $pattern = '/^https:\/\/steamcommunity\.com\/openid\/id\/(7[0-9]{15,25}+)$/';
    preg_match($pattern, $id, $matches);
    $steam_id = $matches[1];

    $url = 'https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/';
    $json = file_get_contents($url.'?key='.AUTH_APIKEY.'&steamids='.$steam_id);
    $content = json_decode($json, true);
    $res = $content['response']['players'][0];
    $username = $res['personaname'];
    $avatar = $res['avatarfull'];

    $user_id = register($db, $username, $steam_id, $avatar);
    $session = login($db, $user_id);

    $url = 'https://'.AUTH_DOMAIN.$redirect;
    $url = rtrim($url, '?&');
    if (parse_url($url, PHP_URL_QUERY))
      $url = $url.'&s='.$session;
    else
      $url = $url.'?s='.$session;
    header('Location: '.$url);
    exit;
  }
  return false;
}

function auth_logout($db, $user_id)
{
  if (!logout($db, $user_id))
    throw new ErrorException('Session Expired', 440);
  return true;
}

function auth_status($db, $session)
{
  $user_id = resume($db, $session);
  if (!$user_id)
    return 0;
  $rows = get_users($db, $user_id, ['user_id','username','session','avatar','consent','consent_stamp','credit','credit_stamp','name']);
  if (count($rows) == 0)
    return 0;
  return $rows[0];
}

$locked = false;

function export_text($db, $id, $langs, $format, $compact)
{
  require_once('export.php');
  $fields = ['t.id AS id','t.label AS label','r.locale AS locale','r.string AS string'];
  $rows = get_text($db, $id, $fields, $langs);
  foreach ($langs as $k => $v)
    $langs[$k] = substr($v, 1, -1);
  if ($format == 'csv')
    export_text_to_csv($rows, $langs, $compact);
  elseif ($format == 'lua')
    export_text_to_lua($rows, $langs, $compact);
  elseif ($format == 'php')
    export_text_to_php($rows, $langs, $compact);
  elseif ($format == 'vdf')
    export_text_to_vdf($rows, $langs, $compact);
  elseif ($format == 'json')
    export_text_to_json($rows, $langs, $compact);
  elseif ($format == 'samplar')
    export_text_samplar($rows, $langs, $compact);
  elseif ($format == 'codes')
    export_text_codes($rows, $langs, $compact);
  else
    echo 'Unsupported format';

  global $locked;
  if (!$locked)
    exit;
}

function export_zip($db, $id, $langs, $format, $compact)
{
  global $locked;
  $locked = true;
  
  $file = tempnam("../cache", "zip");
  $zip = new ZipArchive();
  $zip->open($file, ZipArchive::OVERWRITE);
  
  require_once('export.php');
  $fields = ['t.id AS id','t.label AS label','r.locale AS locale','r.string AS string'];
  $rows = get_text($db, $id, $fields, $langs);
  foreach ($langs as $k => $v)
  {
    $lc = substr($v, 1, -1);;
    $group = array($k => $v);
    ob_start();
    export_text($db, $id, $group, $format, $compact);
    $html = ob_get_contents();
    ob_end_clean();
    $zip->addFromString("$lc.lua", $html);
  }

  $zip->close();
  header('Content-Type: application/zip');
  header('Content-Length: ' . filesize($file));
  header('Content-Disposition: attachment; filename="langs.zip"');
  readfile($file);
  unlink($file);
  
  $locked = false;
  exit;
}