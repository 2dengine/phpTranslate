// installation path
var user = null;
// base locale
const base = 'en';

// url and parameters
const url = new URL(location.href);
const params = url.searchParams;

// page
const page = document.getElementById("page");

// modal window
const modal = document.getElementById('modal');
modal.onclick = function(event) {
  if (event.target == modal)
    trans.cancel();
}

// translation table
var table = document.createElement('TABLE');
table.id = 'table';

table.onclick = function(e) {
  let event = e || window.event;
  let target = event.target || event.srcElement;
  let url = target.getAttribute('data-href');
  if (url)
    window.location.href = url;
}

table.onkeydown = function(e) {
  // keyboard shortcuts
  e = e || window.event;
  let b = e.which || e.keyCode;
  let td = input.parentElement;
  if (!td) return;
  if (b == 27) {
    trans.deselect(false);
    return false;
  }
  // advance using tab or enter
  if (b == 13 || b == 9)
    b = 40;
  // move using the arrow keys
  if (b == 33 || b == 34 || b == 38 || b == 40) {
    let tr = td.parentElement;
    let r = tr.sectionRowIndex;
    let c = td.cellIndex;
    let rows = tr.parentElement.rows;
    let n = rows.length - 1;

    if (b == 38 && r > 0)
      r --; // up
    else if (b == 40 && r < n)
      r ++; // down
    else if (b == 33)
      r = 0; // page up
    else if (b == 34)
      r = n; // page down

    let _tr = rows[r];
    let _td = _tr.cells[c];
    if (_td && td != _td && _tr.id != null && _td.headers != null) {
      for (let j in _tr.cells)
        if (_tr.cells[j] == _td)
          trans.select(_tr.id, j);
    }

    return false;
  }
}

// window history (back/forward buttons)
window.onpopstate = function(e){
  let s = e.state;
  if (s && s.eval)
    eval(s.eval);
};

// input form
var input = document.createElement('TEXTAREA');

input.rows = 1;
input.maxLength = 1000;
input.tabindex = -1;

input.open = function() {
  input.focus();
  if (typeof(input.selectionStart) == 'number') {
    input.selectionStart = input.selectionEnd = input.value.length;
  } else {
    let range = input.createTextRange();
    range.collapse(false);
    range.select();
  }
  input.resize();
}

input.resize = function() {
  let td = input.parentElement;
  let h = 0;
  if (td) {
    input.style.height = 'auto';
    h = Math.max(td.scrollHeight, input.scrollHeight);
  }
  input.style.height = h+'px';
  input.scrollTop = 0;
}

input.onscroll = function(e) {
  input.resize();
}

input.onkeydown = function(e) {
  input.resize();
}

input.onkeyup = function(e) {
  input.resize();
}

// menu form
const formats = {
  'default': 'Export as...',
  'csv': 'CSV',
  'json': 'JSON',
  'lua': 'Lua',
  'lua,zip': 'Lua/ZIP',
  'php': 'PHP',
  'vdf': 'VDF',
  'samplar': 'Samplar'
}

const actions = {
  'default': 'With selected...',
  'remove': 'Remove',
  'group': 'Group'
}

var menu = document.createElement('SELECT');
menu.id = 'menu';

menu.sync = function() {
  let s = trans.selection('true');
  let list = (s.length > 0) ? actions : formats;
  while (menu.firstChild)
    menu.removeChild(menu.firstChild);
  for (let k in list) {
    let op = document.createElement('OPTION');
    if (k == 'default')
      op.selected = op.hidden = true;
    menu.appendChild(op);
    op.caption = op.text = list[k];
    op.value = k;
  }
}

menu.onchange = function() {
  let s = trans.selection('true');
  let v = this.value;
  if (v == "remove")
    trans.remove(s);
  else if (v == "group")
    trans.group(s);
  else
    trans.expo(v);
}


const fields = ['id','label','locale','string','posted','poster_id','username','count','steam_id'];

var trans = {};

trans.post = function(req, func) {
  var query = JSON.stringify(req);
  query = encodeURIComponent(query);
  let session = params.get("s");
  let xhr = new XMLHttpRequest();
  xhr.open('POST', 'request/', true);
  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4)
      func(xhr.status, xhr.responseText);
  }
  xhr.send(`&q=${query}&s=${session}`);
}

trans.get = function(req, func) {
  var query = JSON.stringify(req);
  query = encodeURIComponent(query);
  let time = new Date().getTime();
  let xhr = new XMLHttpRequest();
  xhr.open('GET', `request/?q=${query}&t=${time}`, true);
  xhr.setRequestHeader('Content-type', 'text/xml');
  xhr.onreadystatechange = function() {
    if (xhr.readyState == 4)
      func(xhr.status, xhr.responseText);
  }
  xhr.send();
}

trans.remove = function(ids) {
  var n = ids.length;
  if (n == 0) return;
  if (confirm('Delete '+n+' items?') != true)
    return;
  var req = [{'func':'delete_terms','ids':ids}];
  trans.post(req, function(code, res) {
    // response
    if (code != 200)
      return;
    let pid = params.get("r");
    if (ids.indexOf(pid) != -1)
      params.delete("r");
    trans.load();
  });
}

trans.group = function(ids) {
  // already in the same group?
  let pid = params.get('r');
  if (ids.indexOf(pid) != -1)
    return;
  var req = {'func':'group_terms','ids':ids};
  trans.post([req], function(code, res) {
    trans.load();
  });
}

trans.create = function(pid) {
  var req = {'func':'append_term','id':pid,'label':''};
  trans.post([req], function(code, res) {
    if (code != 200) return;
    var json = JSON.parse(res);
    var id = json[0];
    trans.row(id);
  });
}

trans.expo = function(format) {
  let r = params.get('r');
  let c = params.get('c');
  c = c.split('-');
  let list = format.split(',');
  let zip = list[1] == 'zip';
  format = list[0];
  let func = (zip) ? 'export_zip' : 'export_text';
  let req = {'func':func,'id':r,'langs':c,'format':format,'compact':2};
  let query = JSON.stringify([req]);
  window.location.href = 'request/?q='+query;
}

trans.signin = function() {
  params.delete('s');
  var req = [{'func':'auth_login','url':url.pathname+url.search}];
  trans.get(req, function(code, res) {
    if (code == 200) {
      let json = JSON.parse(res);
      window.location.href = json[0];
    }
  });
}

trans.signout = function() {
  // request
  let req = [{ 'func':'auth_logout' }];
  trans.post(req, function(code, res) {
    // response
    params.delete('s');
    window.location.href = url.href;
  });
}

trans.auth = function() {
  modal.style.display = 'block';
}

trans.cancel = function() {
  modal.style.display = 'none';
}

trans.error = function(code, msg) {
  let title = `${code} Error`;
  let out = String(msg).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');;
  let div = document.createElement('DIV');
  div.className = 'padded';
  div.innerHTML = out;
  trans.page(title, title, div);
}

trans.stats = function(pid, replace) {
  params.set('r', pid);
  params.delete('c');
  let st = { eval:`javascript:trans.stats(${pid}, true);` };
  let func = (replace) ? 'replaceState' : 'pushState';
  window.history[func](st, '', url.pathname+url.search);

  var req = [
    // stats
    { 'func':'get_stats','id':pid },
    // path
    { 'func':'get_path','id':pid },
    // title
    { 'func':'get_text', 'id':pid, 'fields':fields, 'langs':[base], limit:1 }  
  ];
  
  trans.get(req, function(code, res) {
    let json = JSON.parse(res);
    if (code != 200) {
      let msg = (json) ? json[0] : '';
      trans.error(code, msg);
      return;
    }
    
    // document title
    let header = 'Game Translation';
    let title = header;

    if (pid != 0) {
      let h = json[2][0].string;
      //let u = json[1][0].parent_id;
      //let back = `javascript:trans.stats(${u}, false)`;
      //header = `<a href='${back}'><img src="img/back.png" alt="Back" class="icon"></a> ${h}`;
      header = `${h}`;
      title = `${h} - ${title}`;
    }

    // build page
    let body = document.createElement('SPAN');
    let list = trans.progress(pid, json[0]);
    body.appendChild(list);
    trans.page(title, header, body);
  });
}

trans.progress = function(pid, list) {
  let div = document.createElement('DIV');
  let br = document.createElement('BR');
  div.appendChild(br);
  
  // remove unsupported locales
  for (let i = list.length - 1; i >= 0; i--) {
    let v = list[i];
    if (!locales[v.locale])
      list.splice(i, 1);
  }

  // add blank locales
  for (let k in locales) {
    let exists = false;
    for (let i = 0; i < list.length; i++) {
      if (list[i].locale == k) {
        exists = true;
        break;
      }
    }
    if (!exists)
      list.push({ locale:k, count:0, updated:null });
  }

  let max = 0;
  for (let i = 0; i < list.length; i++)
    max = Math.max(max, list[i].count);

  for (let i = 0; i < list.length; i++) {
    let v = list[i];
    let e = document.createElement('DIV');
    e.className = "column nowrap right";
    e.style["width"] = "25%";

    let n = locales[v.locale][0];
    e.innerHTML = `<b><a href='javascript:trans.edit(${pid}, ["en","${v.locale}"], false)'>${n}</a></b>&nbsp;`;
    div.appendChild(e);
    
    let p = document.createElement('DIV');
    p.className = "column nowrap";
    p.style["width"] = "50%";
    let perc = Math.floor(v.count/max*100);
    let sperc = (perc > 10) ? perc+'%' : '&nbsp;';
    p.innerHTML = `<div style="width:${perc}%" class="progress">${sperc}</div>`;
    div.appendChild(p);

    let t = document.createElement('DIV');
    t.className = "column nowrap small";
    t.style["width"] = "25%";
    t.innerHTML = '&nbsp;'+timediff(v.updated);
    div.appendChild(t);

    let br = document.createElement('BR');
    br.style["clear"] = "both";
    div.appendChild(br);
  }
  return div;
}

trans.edit = function(pid, langs, replace) {
  params.set('r', pid);
  params.set('c', langs.join('-'));
  let cc = '["'+langs.join('","')+'"]';
  let st = { eval:`javascript:trans.edit(${pid}, ${cc}, true);` };
  let func = (replace) ? 'replaceState' : 'pushState';
  window.history[func](st, '', url.pathname+url.search);

  // build
  let rlangs = [...langs];
  if (rlangs.indexOf(base) == -1)
    rlangs.push(base);
  let req = [
    // text
    { 'func':'get_text', 'id':pid, 'fields':fields, 'langs':rlangs, limit:10000 },
    // path
    { 'func':'get_path','id':pid },
    // title
    { 'func':'get_text', 'id':pid, 'fields':fields, 'langs':[base], limit:1 }
  ];
  
  trans.get(req, function(code, res) {
    // response
    let json = JSON.parse(res);
    if (code != 200) {
      let msg = (json) ? json[0] : '';
      trans.error(code, msg);
      return;
    }
    // document title
    let header = 'Game Translation';
    let title = header;
    if (pid != 0) {
      // let parent = json[1][0].parent_id;
      let h = json[2][0].string;
      let back = `javascript:trans.stats(${pid}, false)`;
      header = `<a href='${back}'><img src="img/back.png" alt="Back" class="icon"></a> ${h}`;
      title = `${h} - ${title}`;
    }
    // build page
    let body = document.createElement('DIV');
    trans.table(pid, langs, json[0]);
    body.appendChild(table);
    trans.page(title, header, body);
  });
}

trans.page = function(title, header, body) {
  // page title
  document.title = title;
  // content
  while (page.firstChild)
    page.removeChild(page.firstChild);
  // auth
  let login = document.createElement('DIV');
  login.style['float'] = 'right';
  login.style['text-align'] = 'right';

  // avatar image and username
  let avatar = user.avatar;
  if (!avatar)
    avatar = 'img/nouser.jpg';
  login.innerHTML = `<img src="${avatar}" class="avatar" alt="Steam Avatar"> <b>${user.username}</b><br>`;
  if (!user.user_id)
    login.innerHTML += `<a href="javascript:trans.auth();">Sign-in</a>`;
  else
    login.innerHTML += `<a href="javascript:trans.signout();">Sign-out</a>`;

  // header
  let h1 = document.createElement('H1');
  //h1.style['border'] = '1px solid black';
  h1.innerHTML = header;
  
  let head = document.createElement('DIV');
  head.className = 'header';
  head.appendChild(login);
  head.appendChild(h1);
  page.appendChild(head);
  
  // body
  body.className = 'body';
  page.appendChild(body);
  /*
  let foot = document.createElement('DIV');
  foot.className = 'footer';
  foot.innerHTML = `Powered by <a href="https://bitbucket.org/itraykov/phptranslate/">phpTranslate</a>
  <div style="float:right"><a href="/">2dengine.com</a> © 2021</div>`;
  
  page.appendChild(foot);
  */
}

trans.selection = function(state) {
  var ids = [];
  var rows = document.getElementsByTagName('TR');
  for (var i = 0; i < rows.length; i++) {
    var tr = rows[i];
    var s = tr.getAttribute('data-selected');
    if (tr.id && state == s)
      ids.push(tr.id);
  }
  return ids;
}

trans.toggle = function(pid, flag) {
  var tr = document.getElementById(pid);
  var prev = tr.getAttribute('data-selected');
  if (prev == 'disabled')
    return;
  var next = (prev == 'true') ? 'false' : 'true';
  tr.setAttribute('data-selected', next);
  if (tr.nextSibling && tr.nextSibling.firstChild.className == 'group')
    tr.nextSibling.setAttribute('data-selected', next);
  if (flag) {
    var ids = trans.selection(prev);
    for (var i = 0; i < ids.length; i++)
      trans.toggle(ids[i], false);
  }
  menu.sync();
}

trans.row = function(id, data) {
  let tr = document.createElement('TR');
  tr.id = id;
  let tbody = table.tBodies[0];
  tbody.appendChild(tr);
  let isfirst = tbody.firstChild == tr;
  // checkbox
  if (user.admin) {
    let flag = isfirst;
    let td = document.createElement('TD');
    tr.appendChild(td);
    td.className = 'checkbox';
    tr.setAttribute('data-selected', 'false');
    td.setAttribute('data-href', `javascript:trans.toggle(${id}, ${flag});`);
  }
  // strings
  let cells = table.tHead.rows[0].cells;
  for (let i = 0; i < cells.length; i++) {
    let h = cells[i].headers;
    if (!h) continue;
    let td = document.createElement('TD');
    tr.appendChild(td);
    td.headers = h;
    let v = data ? data[h][id] : null;
    if (v) {
      td.appendChild(document.createTextNode(v.string));
      if (v.posted && v.string) {
        let uu = v.username || 'anonymous';
        let dd = timediff(v.posted);
        td.title = `${uu}\n${dd}`;
      }
    }
    td.setAttribute('data-href', `javascript:trans.select(${id}, '${i}');`);
    // cell colors
    let e = (v && v.id && data) ? data[base][v.id] : null;
    if (!v || !v.string)
      td.className = 'error'; // missing
    else if (e && v.posted < e.posted)
      td.className = 'warning'; // older than English version
    else if (e)
      td.className = 'text'; // good
  }

  // more link
  let td = document.createElement('TD');
  tr.appendChild(td);
  let v = (data) ? data.label[id] : null;
  let pid = params.get("r");
  if (v && v.count > 0 && pid != id) {
    td.className = 'group';
    td.innerHTML = v.count+' more';
    td.setAttribute('data-href', `javascript:params.set("r",${id}); trans.load();`);
  }
}

trans.table = function(pid, langs, rows) {
  // ordered ids
  let ids = [];
  for (let i = 0; i < rows.length; i++) {
    let v = rows[i];
    if (ids.indexOf(v.id) == -1)
      ids.push(v.id);
  }
  // terms and labels
  let terms = {};
  for (let i = 0; i < rows.length; i++) {
    let v = rows[i];
    terms[v.id] = { string:v.label, count:v.count };
  }
  // arrange as a table
  let data = {};
  data.label = {};
  for (let id in terms)
    data.label[id] = terms[id];
  data[base] = {};
  for (let i = 0; i < langs.length; i++) {
    let v = langs[i];
    data[v] = {};
    for (let k in terms)
      data[v][k] = null;
  }
  for (let i = 0; i < rows.length; i++) {
    let v = rows[i];
    if (v.locale)
      data[v.locale][v.id] = v;
  }
  // contributors
  let contrib = {};
  for (let k in data)
    contrib[k] = {};
  for (let i = 0; i < rows.length; i++) {
    let v = rows[i];
    let p = v.poster_id;
    if (p == null)
      continue;
    let w = contrib[v.locale];
    if (w[p] == null)
      w[p] = { count:0, poster_id:v.poster_id, steam_id:v.steam_id, username:v.username };
    w[p].count ++;
  }
  // cells
  let cols = [...langs];
  if (user.admin)
    cols.unshift('label');
  
  // rebuild table
  while (table.firstChild)
    table.removeChild(table.firstChild);

  // header
  let thead = document.createElement('THEAD');
  table.appendChild(thead);
  let tr = document.createElement('TR');
  thead.appendChild(tr);
  if (user.admin)
    tr.appendChild(document.createElement('TD'));
  let n = 0;
  for (let i = 0; i < cols.length; i++) {
    let h = cols[i];
    let th = document.createElement('TH');
    th.headers = h;
    tr.appendChild(th);
    if (!locales[h])
      continue;
    // language selector
    let select = document.createElement('SELECT');
    th.appendChild(select);
    for (let c in locales) {
      let op = document.createElement('OPTION');
      select.appendChild(op);
      op.caption = op.text = locales[c][0];
      op.value = c;
      op.selected = (h == c)
    }
    let nn = n;
    select.onchange = function() {
      // switch pages
      langs[nn] = select.value;
      trans.edit(pid, langs, false);
    }
    n ++;
  }
  let blank = document.createElement('TD');
  tr.appendChild(blank);

  // table body
  let tbody = document.createElement('TBODY');
  table.appendChild(tbody);
  for (let j = 0; j < ids.length; j++) {
    let id = ids[j];
    trans.row(id, data);
  }
  
  // list of contributors
  if (user.admin) {
    let cells = thead.rows[0].cells;
    let tfoot = document.createElement('TFOOT');
    table.appendChild(tfoot);
    
    let fr = document.createElement('TR');
    tfoot.appendChild(fr);
    let td1 = document.createElement('TD');
    fr.appendChild(td1);
    
    let td2 = document.createElement('TD');
    td2.appendChild(menu);
    fr.appendChild(td2);
    
    let td3 = document.createElement('TD');
    fr.appendChild(td3);
    td3.style["background-color"] = "red";
    td3.colSpan = cols.length - 1;

    let button = document.createElement('BUTTON');
    button.onclick = function() {
      trans.create(pid);
    }
    button.innerHTML = 'Create';
    td3.appendChild(button);
    
    menu.sync();
    
    let fr2 = document.createElement('TR');
    tfoot.appendChild(fr2);
    for (let i = 0; i < cells.length; i++) {
      let h = cells[i].headers;
      let td = document.createElement('TD');
      fr2.appendChild(td);
      if (h && locales[h]) {
        let users = [];
        for (let k in contrib[h]) {
          let u = contrib[h][k];
          if (k > 0)
            users.push(`<a href="http://steamcommunity.com/profiles/${u.steam_id}">${u.username}</a> (${u.count})`);
          else
            users.push(`anonymous (${u.count})`);
        }
        if (users.length > 0) {
          td.className = 'posts small';
          td.innerHTML = users.join(", ");
        }
      }
    }
  }
}

trans.select = function(id, c) {
  if (!user.user_id) {
    trans.auth();
    return;
  }
  let tr = document.getElementById(id);
  let cells = tr.cells;
  let td = cells[c];
  let _td = input.parentElement;
  if (td == _td) return;
  trans.deselect(true);
  if (td.parentElement.className == 'busy')
    return;
  let txt = '';
  let first = td.firstChild;
  if (first && first.nodeType == 3) {
    txt = first.nodeValue;
    td.removeChild(first);
  }
  input.setAttribute('data-value', txt);
  td.appendChild(input);
  input.value = txt;
  input.open();
}

trans.deselect = function(update)
{
  //menu.close();
  let td = input.parentElement;
  while (td && td.tagName != 'TD')
    td = td.parentElement;
  if (!td) return;
  // deselect
  //td.removeChild(menu);
  let v = input.getAttribute('data-value');
  input.setAttribute('data-value', null);
  input.blur();
  td.removeChild(input);
  let node = document.createTextNode(v);
  td.appendChild(node);
  let u = input.value;
  if (!update || u == v) {
    input.resize();
    return;
  }
  // lock
  td.className = 'busy';
  node.nodeValue = u;
  // column and row
  let table = td.parentElement;
  while (table && table.tagName != 'TABLE')
    table = table.parentElement;
  let header = td.headers;
  let tr = td.parentElement;
  // request
  let req = null;
  if (header == 'label')
    req = {'func':'set_label','id':tr.id,'label':u};
  else
    req = {'func':'set_text','id':tr.id,'lang':header,'string':u};
  
  trans.post([req], function(code, res) {
    // unlock
    node.nodeValue = v;
    if (code != 200)
      return;
    // load
    node.nodeValue = u;
    td.className = 'text';
  });
}

trans.load = function() {
  if (!user)
    user = { user_id:0, username:'anonymous', session:0 };
  user.admin = (user.user_id == 1);

  let rid = params.get('r');
  if (rid == null)
    rid = 0;

  let langs = params.get('c');
  if (langs) {
    // edit specified languages
    langs = langs.replace(/,/g,'-').split('-');
    trans.edit(rid, langs, true);
  } else {
    // general language overview
    trans.stats(rid, true);
  }
}

// logged in?
let session = params.get('s');
if (session) {
  // validate session
  let req = [{'func':'auth_status','id':session}];
  
  trans.get(req, function(code, res) {
    if (code == 200) {
      let json = JSON.parse(res);
      if (json && json[0])
        user = json[0];
    }
    trans.load();
  });
} else {
  // guest
  trans.load();
}
