<?php
// Transpose and indexing

// Returns an associative array of terms, indexed by id
function index_text_by_id($rows, $langs, $compact = 0)
{
  $index = array();
  foreach ($rows as &$row)
  {
    if (!isset($row['id']))
      continue;
    $id = $row['id'];
    if ($compact >= 2 and (!isset($row['string']) or !$row['string']))
      continue;
    $label = (isset($row['label'])) ? $row['label'] : null;
    if (!isset($index[$id]))
      $index[$id] = array('id'=>$id, 'label'=>$label);
    if (isset($row['locale']) and isset($row['string']))
      $index[$id][$row['locale']] = $row['string'];
  }
  if (!$compact)
    foreach ($index as $id => $item)
      foreach ($langs as $lang)
        if (!isset($item[$lang]))
          $index[$id][$lang] = null;
  return $index;
}

// Returns a list of terms, grouped by id
function group_text_by_id($rows, $langs, $compact = 0)
{
  $index = index_text_by_id($rows, $langs, $compact);
  $list = [];
  foreach ($index as $item)
    $list[] = $item;
  return $list;
}

// Returns an associative array of terms, grouped by languague
function group_text_by_lang($rows, $langs, $compact = 0)
{
  $index = index_text_by_id($rows, $langs, $compact);
  $groups = array();
  foreach ($langs as $lang)
  {
    $group = array();
    foreach ($index as $item)
    {
      if ($compact and (!isset($item[$lang]) or !$item[$lang]))
        continue;
      $label = $item['label'];
      $key = $label;
      for ($i = 2; isset($group[$key]); $i++)
        $key = $label.'\\'.$i;
      $group[$key] = $item[$lang];
    }
    if ($compact >= 2 and empty($group))
      continue;
    $groups[$lang] = $group;
  }
  return $groups;
}

// Export and output operations

function _uniord($c) {
  if ($c != '')
  {
    if (ord($c{0}) >=0 && ord($c{0}) <= 127)
      return ord($c{0});
    if (ord($c{0}) >= 192 && ord($c{0}) <= 223)
      return (ord($c{0})-192)*64 + (ord($c{1})-128);
    if (ord($c{0}) >= 224 && ord($c{0}) <= 239)
      return (ord($c{0})-224)*4096 + (ord($c{1})-128)*64 + (ord($c{2})-128);
    if (ord($c{0}) >= 240 && ord($c{0}) <= 247)
      return (ord($c{0})-240)*262144 + (ord($c{1})-128)*4096 + (ord($c{2})-128)*64 + (ord($c{3})-128);
    if (ord($c{0}) >= 248 && ord($c{0}) <= 251)
      return (ord($c{0})-248)*16777216 + (ord($c{1})-128)*262144 + (ord($c{2})-128)*4096 + (ord($c{3})-128)*64 + (ord($c{4})-128);
    if (ord($c{0}) >= 252 && ord($c{0}) <= 253)
      return (ord($c{0})-252)*1073741824 + (ord($c{1})-128)*16777216 + (ord($c{2})-128)*262144 + (ord($c{3})-128)*4096 + (ord($c{4})-128)*64 + (ord($c{5})-128);
    if (ord($c{0}) >= 254 && ord($c{0}) <= 255)    //  error
      return false;
  }
  return 0;
}   //  function _uniord()

function export_text_samplar($rows, $langs, $compact = 0)
{
  $chars = array();
  foreach ($rows as $row)
  {
    $s = $row['string'];
    $l = mb_strlen($s);
    for ($i = 0; $i < $l; $i++)
    {
      $c = mb_substr($s, $i, 1, 'UTF-8');
      if ($c == '')
        continue;
      if (!isset($chars[$c]))
        $chars[$c] = 0;
      $chars[$c] ++;
    }
  }
  arsort($chars);
  if (!$compact)
  {
    echo "count\tchar\tcode\thex\tencode\r\n";
    foreach ($chars as $c => $n)
    {
      $raw = _uniord((string)$c);
      $enc = mb_detect_encoding($c);
      echo $n,"\t",$c,"\t",$raw,"\t",sprintf('%04x',$raw),"\t",$enc,"\r\n";
    }
  }
  else
  {
    foreach ($chars as $c => $n)
      echo $c;
  }
}

function export_text_codes($rows, $langs, $compact = 0)
{
  $chars = array();
  foreach ($rows as $row)
  {
    $s = $row['string'];
    $l = mb_strlen($s);
    for ($i = 0; $i < $l; $i++)
    {
      $c = mb_substr($s, $i, 1, 'UTF-8');
      if ($c == '')
        continue;
      if (!isset($chars[$c]))
        $chars[$c] = 0;
      $chars[$c] = _uniord((string)$c);
    }
  }
  asort($chars);
  echo "{\r\n";
  foreach ($chars as $c => $v) {
    echo '0x',sprintf('%x',$v),',';
    if ($compact == 0)
      echo '--',$c;
    echo "\r\n";
  }
  echo "}";
}

function export_text_to_csv($rows, $langs, $compact = 0)
{
  $terms = group_text_by_id($rows, $langs, $compact);
  $lines = [];
  $lines[0][] = 'label';
  $cols = [];
  foreach ($langs as $lang)
  {
    if ($compact >= 1)
    {
      $exists = false;
      foreach ($terms as $term)
        if (isset($term[$lang]) and $term[$lang])
        {
          $exists = true;
          break;
        }
      if (!$exists)
        continue;
    }
    $lines[0][] = $lang;
    $cols[] = $lang;
  }
  foreach ($terms as $item)
  {
    $key = (isset($item['label'])) ? $item['label'] : $item['id'];
    $line = [$key];
    foreach ($cols as $lang)
      $line[] = (isset($item[$lang])) ? $item[$lang] : null;
    $lines[] = $line; 
  }
  // output
  $out = fopen('php://output', 'w');
  foreach ($lines as $line)
    fputcsv($out, $line);
}

function export_text_to_lua($rows, $langs, $compact = 0)
{
  global $locked;
  // output
  $groups = group_text_by_lang($rows, $langs, $compact);
  echo '-- ', gmdate('c'), "\n";
  foreach ($groups as $lc => $text)
  {
    if (!$locked)
      echo "$lc=\n";
    else
      echo "return";
    echo "{\n";
    foreach ($text as $k => $v)
    {
      $v = ($v !== null) ? '"'.addcslashes($v, '"').'"' : 'nil';
      //$v = preg_replace("/[\n\r]/", "\\n", $v);
      //$v = str_replace("\\\\", "\\", $v);
      if ($compact == 0 or !preg_match('/^[a-zA-Z_][a-zA-Z0-9_]+$/', $k))
      {
        $k = addcslashes($k, "'\\");
        $k = "['$k']";
      }
      echo "$k=$v,\n";
    }
    echo "}\n";
  }
}

function export_text_to_vdf($rows, $langs, $compact = 0)
{
  // steam tokens
  $slangs = array(
  'bg'=>'bulgarian',
  'cs'=>'czech',
  'da'=>'danish',
  'nl'=>'dutch',
  'en'=>'english',
  'fi'=>'finnish',
  'fr'=>'french',
  'el'=>'greek',
  'de'=>'german',
  'hu'=>'hungarian',
  'it'=>'italian',
  'ja'=>'japanese',
  'ko'=>'koreana',
  'no'=>'norwegian',
  'pl'=>'polish',
  'pt_pt'=>'portuguese',
  'pt_br'=>'brazilian',
  'ru'=>'russian',
  'ro'=>'romanian',
  'zh_cn'=>'schinese',
  'es'=>'spanish',
  'sv'=>'swedish',
  'zh_tw'=>'tchinese',
  'th'=>'thai',
  'tr'=>'turkish',
  'uk'=>'ukrainian');
  echo "\"lang\"\n{\n";
  $groups = group_text_by_lang($rows, $langs, $compact);
  foreach ($groups as $lc => $text)
  {
    $lcn = (isset($slangs[$lc])) ? strtolower($slangs[$lc]) : $lc;
    echo "\t\"$lcn\"\n\t{\n\t\t\"Tokens\"\n\t\t{\n";
    foreach ($text as $k => $v)
      echo "\t\t\t\"".addcslashes($k, '"\\')."\"\t\"".addcslashes($v, '"\\')."\"\n";
    echo "\t\t}\n\t}\n";
  }
  echo "}\n";
}

function export_text_to_php($rows, $langs, $compact = 0)
{
  $groups = group_text_by_lang($rows, $langs, $compact);
  echo serialize($groups);
}

function export_text_to_json($rows, $langs, $compact = 0)
{
  $groups = group_text_by_lang($rows, $langs, $compact);
  echo json_encode($groups);
}
