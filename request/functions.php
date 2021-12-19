<?php
$locked = false;

class API {
  protected $db;
  protected $user;
  
  function __construct($db, $session) {
    $this->db = $db;
    $this->user = $this->getUser($session);
  }
  
  function query($sql) {
    $res = mysqli_query($this->db, $sql);
    if (!$res)
      throw new ErrorException(mysqli_error($this->db), 500);
    return $res;
  }

  function getUser($session) {
    $session = mysqli_real_escape_string($this->db, $session);
    $user_ip = mysqli_real_escape_string($this->db, $_SERVER['REMOTE_ADDR']);
    $res = $this->query("SELECT user_id,session,admin,username,avatar,consent,consent_stamp,credit,credit_stamp,name
      FROM `users`
      WHERE session = '$session'
        AND user_ip = INET6_ATON('$user_ip')");
    if ($res and mysqli_num_rows($res))
      return mysqli_fetch_assoc($res);
  }

  function login($user_id) {
    if (!$user_id) return 0;
    $user_ip = mysqli_real_escape_string($this->db, $_SERVER['REMOTE_ADDR']);
    $session = rand();
    $this->query("UPDATE `users`
      SET session = '$session',
        user_ip = INET6_ATON('$user_ip'),
        lastactive = NOW()
      WHERE user_id = $user_id");
    $res = $this->query("SELECT session FROM `users`
      WHERE user_id = $user_id");
    if (!$res or !mysqli_num_rows($res))
      return 0;
    $row = mysqli_fetch_assoc($res);
    return $row['session'];
  }

  function logout() {
    if (!$this->user)
      return false;
    $user_id = $this->user['id'];
    $res = $this->query("UPDATE `users`
      SET session = NULL
      WHERE user_id = $user_id");
    if (!$res or !mysqli_affected_rows($res))
      return false;
    return true;
  }

  function register($username, $steam_id, $avatar)
  {
    $username = mysqli_real_escape_string($this->db, $username);
    $steam_id = mysqli_real_escape_string($this->db, $steam_id);
    $user_ip = mysqli_real_escape_string($this->db, $_SERVER['REMOTE_ADDR']);
    $avatar = mysqli_real_escape_string($this->db, $avatar);
    $this->query("INSERT INTO `users`
        (username, steam_id, user_ip, joined, avatar)
      VALUES
        ('$username', '$steam_id', INET6_ATON('$user_ip'), NOW(), '$avatar')
      ON DUPLICATE KEY
        UPDATE username = '$username', lastactive = NOW(), avatar = '$avatar'");
    $res = $this->query("SELECT user_id FROM `users`
      WHERE steam_id = '$steam_id'");
    $row = mysqli_fetch_assoc($res);
    return $row['user_id'];
  }
  
  function unregister($owner_id) {
    if ((!$this->user) or (!$this->user['admin'] and $this->user['user_id'] != $owner_id))
      throw new ErrorException('Unauthorized', 401);
    $this->query("DELETE FROM `revisions` WHERE poster_id = $owner_id");
    $this->query("DELETE FROM `users` WHERE user_id = $owner_id");
    return true;
  }
  
  function getTerms($ids) {
    $set = implode(',', $ids);
    $res = $this->query("SELECT id,parent_id,label,owner_id
      FROM `terms` AS t
      WHERE id IN ($set)");
    if (mysqli_num_rows($res) != count($ids))
      throw new ErrorException('Partial or missing results', 403);
    return mysqli_fetch_all($res, MYSQLI_ASSOC);
  }
  
  function getPath($id) {
    $path = [];
    while ($id and $rows = $this->getTerms([$id])) {
      $parent = $rows[0];
      array_unshift($path, $parent);
      $id = $parent['parent_id'];
    }
    return $path;
  }
  
  function getTexts($id, $langs, $fields = null) {
    if (!$fields) {
      // do not include personal data unless admin
      $fields = 'id,label,r.locale,r.string,UNIX_TIMESTAMP(r.posted) AS posted,r.poster_id,r.approved';
      if ($this->user and $this->user['admin'])
        $fields .= ',username,steam_id';
    }
    $set = '"'.implode('","', $langs).'"';
    $res = $this->query(
    "SELECT SQL_CALC_FOUND_ROWS $fields,(SELECT COUNT(*) FROM `terms` AS c WHERE c.parent_id = t.id) AS count
      FROM `terms` AS t
      LEFT JOIN `revisions` AS r
        ON r.term_id = t.id
        AND r.locale IN ($set)
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
      LIMIT 1000");
    return mysqli_fetch_all($res, MYSQLI_ASSOC);
  }

  function checkPermissions($ids) {
    if (!$this->user)
      return false;
    if ($this->user['admin'])
      return true;
    $terms = $this->getTerms($ids);
    foreach ($terms as $v)
      if ($v['owner_id'] != $this->user['user_id'])
        return false;
    return true;
  }
  
  function appendTerm($parent_id, $label) {
    if (!$this->checkPermissions([$parent_id]))
      throw new ErrorException('Unauthorized', 401);
    $owner_id = $this->user['user_id'];
    $label = mysqli_real_escape_string($this->db, $label);
    $this->query("INSERT INTO `terms`
      (`parent_id`, `label`, `owner_id`)
      VALUES ($parent_id, '$label', $owner_id)");
    return mysqli_insert_id($this->db);
  }
  
  function deleteTerms($ids) {
    if (!$this->checkPermissions($ids))
      throw new ErrorException('Unauthorized', 401);
    // remove from db
    $set = implode(',', $ids);
    $this->query("DELETE FROM `terms`
      WHERE id IN ($set)");
    // remove sub-items
    while (mysqli_affected_rows($db) > 0)
      $this->query("DELETE a FROM `terms` a
        RIGHT JOIN `terms` b
          ON a.parent_id = b.id
        WHERE ISNULL(b.id)");
    return true;
  }
  
  function groupTerms($ids) {
    if (!$this->checkPermissions($ids))
      throw new ErrorException('Unauthorized', 401);
    $parent_id = array_shift($ids);
    if (in_array($parent_id, $ids))
      throw new ErrorException('Term cannot be parented by itself', 400);
    $parent = $this->getTerms([$parent_id])[0];
    $ids = implode(',', $ids);
    $this->query("UPDATE `terms`
      SET parent_id = {$parent['id']}
      WHERE id IN ($ids)
        AND parent_id = {$parent['parent_id']}");
    return true;
  }

  function setApproved($ids, $langs, $approved) {
    if (!$this->checkPermissions($ids))
      throw new ErrorException('Unauthorized', 401);
    $set = implode(',', $ids);
    $langs = '"'.implode('","', $langs).'"';
    $status = ($approved) ? 'TRUE' : 'FALSE';
    $this->query("UPDATE `revisions` AS r
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

  function setLabel($id, $label) {
    if (!$this->checkPermissions([$id]))
      throw new ErrorException('Unauthorized', 401);
    $label = mysqli_real_escape_string($this->db, $label);
    $this->query("UPDATE `terms`
      SET label = '$label'
      WHERE id = '$id'");
    return true;
  }

  function setText($id, $lang, $string) {
    if (!$this->user)
      throw new ErrorException('Unauthorized', 401);
    $poster_id = $this->user['user_id'];
    $string = mysqli_real_escape_string($this->db, $string);
    $poster_ip = mysqli_real_escape_string($this->db, $_SERVER['REMOTE_ADDR']);
    $this->query(
    "INSERT INTO `revisions`
      (term_id, locale, string, poster_id, poster_ip)
      VALUES
      ($id, '$lang', '$string', $poster_id, INET6_ATON('$poster_ip'))");
    return true;
  }

  function setConsent($on) {
    if (!$this->user)
      throw new ErrorException('Unauthorized', 401);
    $owner_id = $this->user['user_id'];
    $bool = ($on) ? 'TRUE' : 'FALSE';
    $this->query("UPDATE `users` SET consent = $bool, consent_stamp = NOW() WHERE user_id = $owner_id");
    return true;
  }

  function setCredit($on) {
    if (!$this->user)
      throw new ErrorException('Unauthorized', 401);
    $owner_id = $this->user['user_id'];
    $bool = ($on) ? 'TRUE' : 'FALSE';
    $this->query("UPDATE `users` SET credit = $bool, credit_stamp = NOW() WHERE user_id = $owner_id");
    return true;
  }

  function setName($string) {
    if (!$this->user)
      throw new ErrorException('Unauthorized', 401);
    $owner_id = $this->user['user_id'];
    $this->query("UPDATE `users` SET name = '$string' WHERE user_id = $owner_id");
    return true;
  }
  
  
  function exportText($id, $langs, $format, $compact) {
    require_once('export.php');
    //$fields = 't.id AS id, t.label AS label, r.locale AS locale, r.string AS string';
    $rows = $this->getTexts($id, $langs);//, $fields);
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

  function exportZIP($id, $langs, $format, $compact) {
    global $locked;
    $locked = true;
    
    $file = tempnam("../cache", "zip");
    $zip = new ZipArchive();
    $zip->open($file, ZipArchive::OVERWRITE);
    
    require_once('export.php');
    //$fields = 't.id AS id, t.label AS label, r.locale AS locale, r.string AS string';
    //$rows = $this->getTexts($id, $langs);//, $fields);
    foreach ($langs as $k => $v)
    {
      $lc = $v;//substr($v, 1, -1);;
      $group = array($k => $v);
      ob_start();
      $this->exportText($id, $group, $format, $compact);
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
}


class Getter {
  function __construct($api) {
    $this->api = $api;
  }
  
  protected function getInteger($input, $key) {
    $out = isset($input[$key]) ? $input[$key] : null;
    $out = filter_var($out, FILTER_VALIDATE_INT);
    if ($out === false)
      throw new ErrorException('Integer expected:'.$key, 401);
    return $out;
  }
  
  protected function getString($input, $key) {
    $out = isset($input[$key]) ? $input[$key] : null;
    $out = filter_var($out, FILTER_DEFAULT);
    if ($out === false)
      throw new ErrorException('String expected:'.$key, 401);
    return $out;
  }
  
  protected function getIds($input) {
    $ids = isset($input['ids']) ? $input['ids'] : null;
    if (!is_array($ids) or !count($ids))
      throw new ErrorException('Array expected:ids', 401);
    foreach ($ids as $v)
      if (filter_var($v, FILTER_VALIDATE_INT) === false)
        throw new ErrorException('Integer expected in array:ids', 401);
    return $ids;
  }
  
  protected function getLangs($input) {
    global $langs;
    $list = isset($input['langs']) ? $input['langs'] : null;
    if (!is_array($list) or !count($list))
      throw new ErrorException('Array expected:langs', 401);
    foreach ($list as $v)
      if (!in_array($v, $langs))
        throw new ErrorException('Locale expected in array:langs', 401);
    return $list;
  }

  function getPath($input) {
    $id = $this->getInteger($input, 'id');
    return $this->api->getPath($id);
  }

  function getTexts($input) {
    $id = $this->getInteger($input, 'id');
    $langs = $this->getLangs($input);
    return $this->api->getTexts($id, $langs);
  }

  function getUser($input) {
    $session = $this->getInteger($input, 'session');
    $user = $this->api->getUser($session);
    if (!$user)
      throw new ErrorException('Session Expired', 440);
    return $user;
  }


  function login($input) {
    require_once('openid.php');
    $openid = new LightOpenID(AUTH_DOMAIN);
    if (!$openid->mode) {
      $openid->identity = AUTH_IDENTITY;
      return $openid->authUrl();
    } elseif ($openid->mode != 'cancel' and $openid->validate()) { 
      $redirect = $this->getString($input, 'url');
      
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

      $user_id = $this->api->register($username, $steam_id, $avatar);
      $session = $this->api->login($user_id);

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
  
  function exportText($input) {
    $id = $this->getInteger($input, 'id');
    $langs = $this->getLangs($input);
    $format = $this->getString($input, 'format');
    $compact = $this->getInteger($input, 'compact');
    return $this->api->exportText($id, $langs, $format, $compact);
  }

  function exportZIP($input) {
    $id = $this->getInteger($input, 'id');
    $langs = $this->getLangs($input);
    $format = $this->getString($input, 'format');
    $compact = $this->getInteger($input, 'compact');
    return $this->api->exportZIP($id, $langs, $format, $compact);
  }
}

class Poster extends Getter {
  function appendTerm($input) {
    $parent_id = $this->getInteger($input, 'parent_id');
    $label = $this->getString($input, 'label');
    return $this->api->appendTerm($parent_id, $label);
  }
  
  function deleteTerms($input) {
    $ids = $this->getIds($input, 'ids');
    return $this->api->deleteTerms($ids);
  }
  
  function groupTerms($input) {
    $ids = $this->getIds($input, 'ids');
    return $this->api->groupTerms($ids);
  }
  
  function setLabel($input) {
    $id = $this->getInteger($input, 'id');
    $string = $this->getString($input, 'label');
    return $this->api->setLabel($id, $string);
  }
  
  function setText($input) {
    $id = $this->getInteger($input, 'id');
    $lang = $this->getString($input, 'lang');
    $string = $this->getString($input, 'string');
    return $this->api->setText($id, $lang, $string);
  }
  
  function unregister($input) {
    return $this->api->unregister();
  }
  
  function setConsent($input) {
    $on = $this->getInteger($input, 'approve');
    return $this->api->setConsent($on);
  }

  function setCredit($input) {
    $on = $this->getInteger($input, 'approve');
    return $this->api->setCredit($on);
  }

  function setName($input) {
    $name = $this->getString($input, 'name');
    return $this->api->setName($name);
  }
  
  function setApproved($input) {
    $ids = $this->getIds($input);
    $langs = $this->getLangs($input);
    $on = $this->getInteger($input, 'approve');
    return $this->api->setApproved($ids, $langs, $on);
  }

  function logout($input) {
    if (!$this->api->logout())
      throw new ErrorException('Session Expired', 440);
    return true;
  }
}
