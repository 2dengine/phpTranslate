<?php
$fields = array
(
  'id'=>'t.id',
  'parent_id'=>'t.parent_id',
  'label'=>'t.label',
  'owner_id'=>'t.owner_id',
  'count'=>'(SELECT COUNT(*) FROM `terms` AS c WHERE c.parent_id = t.id) AS count',
  
  'term_id'=>'r.term_id',
  'locale'=>'r.locale',
  'string'=>'r.string',
  'posted'=>'UNIX_TIMESTAMP(r.posted) AS posted',
  'poster_id'=>'r.poster_id',
  'approved'=>'r.approved',

  'user_id'=>'u.user_id',
  'username'=>'u.username',
  'steam_id'=>'u.steam_id',
  'post_count'=>'(SELECT COUNT(*) FROM `revisions` AS c WHERE c.poster_id = u.user_id) AS post_count',
  'ip'=>'INET_NTOA(u.ip) AS ip',
  'joined'=>'UNIX_TIMESTAMP(u.joined) AS joined',
  'lastactive'=>'UNIX_TIMESTAMP(u.lastactive) AS lastactive',
);