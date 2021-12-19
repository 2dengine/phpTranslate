// installation path
var user = null;
// base locale
const base = 'en';

// url and parameters
const url = new URL(location.href);
const params = url.searchParams;
if (!params.has('c'))
  params.set('c', 'en-es');

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
  'group': 'Group',
  'approve': 'Approve',
  'unapprove': 'Unapprove'
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
  if (trans[v])
    trans[v](s);
  else
    trans.expo(v);
}


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
  var req = {'func':'deleteTerms','ids':ids};
  trans.post([req], function(code, res) {
    // response
    if (code != 200)
      return;
    let pid = params.get("r");
    if (ids.indexOf(pid) != -1)
      params.delete("r");
    trans.load();
  });
}

trans.setapproved = function(ids, ok) {
  let c = params.get('c');
  c = c.split('-');
  let action = (ok == 1) ? 'Approve' : 'Unapprove';
  let chosen = [];
  for (let i = 0; i < c.length; i++)
    if (confirm(action+' '+ids.length+' terms in '+locales[c[i]][1]+'?'))
      chosen.push(c[i]);
  // ignore base language
  //const index = c.indexOf(base);
  //if (index > -1)
    //c.splice(index, 1);
  if (ids.length == 0 || chosen.length == 0)
    return;
  var req = {'func':'setApproved','ids':ids,'langs':chosen,'approve':ok};
  trans.post([req], function(code, res) {
console.log(res);
    // response
    if (code != 200)
      return;
    trans.load();
  });
}

trans.approve = function(ids) {
  trans.setapproved(ids, 1);
}

trans.unapprove = function(ids) {
  trans.setapproved(ids, 0);
}

trans.group = function(ids) {
  // already in the same group?
  let pid = params.get('r');
  if (ids.indexOf(pid) != -1)
    return;
  var req = {'func':'groupTerms','ids':ids};
  trans.post([req], function(code, res) {
    trans.load();
  });
}

trans.create = function(pid) {
  var req = {'func':'appendTerm','parent_id':pid,'label':''};
  trans.post([req], function(code, res) { 
    if (code != 200) return;
    var json = JSON.parse(res);
    var id = json[0];
    trans.row(id);

    var div = table.tBodies[0];
    div.scrollTop = div.scrollHeight - div.clientHeight;
  });
}

trans.expo = function(format) {
  let r = params.get('r');
  let c = params.get('c');
  c = c.split('-');
  let list = format.split(',');
  let zip = list[1] == 'zip';
  format = list[0];
  let func = (zip) ? 'exportZIP' : 'exportText';
  let req = {'func':func,'id':r,'langs':c,'format':format,'compact':2};
  let query = JSON.stringify([req]);
  window.location.href = 'request/?q='+query;
}

trans.signin = function() {
  params.delete('s');
  var req = {'func':'login','url':url.pathname+url.search};
  trans.get([req], function(code, res) {
    if (code == 200) {
      let json = JSON.parse(res);
      window.location.href = json[0];
    }
  });
}

trans.signout = function() {
  // request
  let req = { 'func':'logout' };
  trans.post([req], function(code, res) {
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
  div.textContent = out;
  trans.page(title, title, div);
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
    { 'func':'getTexts', 'id':pid, 'langs':rlangs },
    // path
    { 'func':'getPath','id':pid },
    // title
    { 'func':'getTexts', 'id':pid, 'langs':[base] }
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
    let path = json[1];
    if (path && path.length > 0) {
      let parent = path[path.length - 1].parent_id;
      let head = json[2][0].string;
      header = trans.breadcrumbs(head, `javascript:trans.edit(${parent}, ${cc}, false)`);
      title = `${head} - ${title}`;
    }
    // build page
    let cont = document.createElement('DIV');
    trans.table(pid, langs, json[0]);
    cont.appendChild(table);
    trans.page(title, header, cont);
  });
}

trans.breadcrumbs = function(title, link) {
  let img = document.createElement('IMG');
  img.src = 'img/back.png';
  img.alt = 'Back';
  img.className = 'icon';
  let back = document.createElement('A');
  back.href = link;
  back.appendChild(img);
  let span = document.createElement('SPAN');
  span.appendChild(back);
  span.appendChild(document.createTextNode(title));
  return span;
}

trans.profile = function(replace) {
  params.set('r', 'profile');
  params.delete('c');
  let st = { eval:`javascript:trans.profile(true);` };
  let func = (replace) ? 'replaceState' : 'pushState';
  window.history[func](st, '', url.pathname+url.search);

  let title = 'Edit Profile';
  let header = trans.breadcrumbs('Profile', 'javascript:trans.edit(0, ["en","es"], false);');
  let cont = document.createElement('DIV');
  let consent = (user.consent) ? 'checked' : '';
  let credit = (user.credit) ? 'checked' : '';
  let name = user.name ? user.name : '';
  cont.innerHTML = `
    <div class="padded">
      <h2>Allow the use of your translations?</h2>
      <h4 id="consent_header" class="padded">
        <input type="checkbox" ${consent} id="consent" onclick="trans.syncme();"> I grant permission and royalty-free license for the use, modification, publication and distribution of all textual content that I contribute to 2dengine. Furthermore, I declare that my contributions do not infringe upon the rights of any third party and do not contain any material that violates local or international law. (required)
      </h4>

      <h2>How would you like to be credited?</h2>
      <b>Credits alias or pseudonym</b><br>
      <input type="text" value="${name}" id="name" class="padded" onkeydown="trans.syncme();" onchange="trans.syncme();"></input>
      <h4 class="padded">
        <input type="checkbox" ${credit} id="credit" onclick="trans.syncme();"> I consent to the "alias" or "pseudonym" specified above being displayed publicly in games or other projects developed by 2dengine. (optional)
      </h4>
      
      <h2>Changed your mind?</h2>
      <div class="padded">
        <b>You can permanently <a href="javascript:trans.unregister();">delete account</a> and remove your contributions at any time.</b>
      </div>
    </div>
  `;
  trans.page(title, header, cont);
  const consent_header = document.getElementById('consent_header');
  if (!user.consent)
    consent_header.className = 'padded error';
}

trans.syncme = function(e) {
  const check1 = document.getElementById('consent');
  const check2 = document.getElementById('credit');
  const name = document.getElementById('name');
  var req = [    
    {'func':'setConsent','approve':check1.checked ? 1 : 0},
    {'func':'setCredit','approve':check2.checked ? 1 : 0},
    {'func':'setName','name':name.value}
  ];
  trans.post(req, function(code, res) {
    // response
    if (code != 200)
      return;
    user.consent = check1.checked;
    user.credit = check1.credit;
    user.name = name.value;
    const consent_header = document.getElementById('consent_header');
    consent_header.className = user.consent ? 'padded' : 'error padded';
  });
}

trans.unregister = function() {
  if (!confirm("Delete your account and contributions?"))
    return;
  let verify = prompt("Please type in the word \"delete\" to delete your account and permanently remove your contributions");
  if (verify && verify == "delete") {
    var req = {'func':'unregister'};
    trans.post([req], function(code, res) {
      // response
      if (code != 200)
        return;
      alert("Your account and contributions have been deleted");
      location.href = "?";
    });
    return;
  }
}

trans.page = function(title, header, cont) {
  // page title
  document.title = title;
  // content
  while (page.firstChild)
    page.removeChild(page.firstChild);
  // auth
  let login = document.createElement('DIV');
  login.className = 'login';

  // avatar image and username
  let avatar = user.avatar;
  if (!avatar)
    avatar = 'img/nouser.jpg';
  let username = user.username.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  let profile = 'javascript:trans.profile(false);';
  if (!user.user_id)
    profile = 'javascript:trans.auth();';
  login.innerHTML = `<a href="${profile}"><img src="${avatar}" class="avatar" alt="Steam Avatar"></a> <b>${username}</b><br>`;
  if (!user.user_id)
    login.innerHTML += `<a href="javascript:trans.auth();">Sign-in</a>`;
  else
    login.innerHTML += `<a href="javascript:trans.signout();">Sign-out</a>`;

  // header
  let h1 = document.createElement('H1');
  //h1.style['border'] = '1px solid black';
  if (typeof header === 'string' || header instanceof String)
    h1.textContent = header;
  else
    h1.innerHTML = header.innerHTML;
  
  let head = document.createElement('DIV');
  head.className = 'header';
  head.appendChild(login);
  head.appendChild(h1);
  page.appendChild(head);
  
  // body
  cont.className = 'content';
  page.appendChild(cont);

  trans.resize();
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
  let cb = document.createElement('TD');
  tr.appendChild(cb);
  if (user.admin) {
    tr.setAttribute('data-selected', 'false');
    cb.className = 'checkbox';
    cb.setAttribute('data-href', `javascript:trans.toggle(${id}, ${isfirst});`);
  }
  // strings
  let cells = table.tHead.rows[0].cells;
  for (let i = 0; i < cells.length; i++) {
    let h = cells[i].headers;
    if (!h) continue;
    let td = document.createElement('TD');
    tr.appendChild(td);
    td.headers = h;
    let v = (data) ? data[h][id] : null;
    if (v) {
      //td.appendChild(document.createTextNode(v.string));
      td.textContent = v.string;
      if (v.posted && v.string) {
        td.title = timediff(v.posted);
        if (user.admin)
          td.title = (v.username || 'anonymous') + '\n' + td.title;
      }
    }
    if (h != 'label' || user.admin)
      td.setAttribute('data-href', `javascript:trans.select(${id}, '${i}');`);
    if (h != 'label') {
      // cell colors
      let e = (v && v.id && data) ? data[base][v.id] : null;
      if (!v || !v.string)
        td.className = 'error'; // missing
      else if (e && v.posted < e.posted)
        td.className = 'warning'; // older than English version
      else if (e)
        td.className = 'text'; // good
    }
  }

  // more link
  let td = document.createElement('TD');
  tr.appendChild(td);
  let v = (data) ? data.label[id] : null;
  let pid = params.get("r");
  if (v && v.count > 0 && pid != id) {
    let langs = params.get('c');
    langs = langs.replace(/,/g,'-').split('-');
    let cc = '["'+langs.join('","')+'"]';
    td.className = 'group';
    td.textContent = v.count+' more';
    //td.setAttribute('data-href', `javascript:params.set("r",${id}); trans.load();`);
    td.setAttribute('data-href', `javascript:trans.edit(${id}, ${cc}, false);`);
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

  // cells
  let cols = [...langs];
  //if (user.admin)
    cols.unshift('label');
  
  // rebuild table
  while (table.firstChild)
    table.removeChild(table.firstChild);

  // header
  let thead = document.createElement('THEAD');
  table.appendChild(thead);
  let tr = document.createElement('TR');
  thead.appendChild(tr);
  //if (user.admin) {
    let th = tr.appendChild(document.createElement('TH'));
    th.className = 'checkbox';
  //}
  let n = 0;
  for (let i = 0; i < cols.length; i++) {
    let h = cols[i];
    let th = document.createElement('TH');
    th.headers = h;
    tr.appendChild(th);
    if (h == 'label' && user.admin) {
      let button = document.createElement('BUTTON');
      button.onclick = function() {
        trans.create(pid);
      }
      button.textContent = 'Create';
      th.appendChild(button);      
    }
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
  if (user.admin)
    blank.appendChild(menu);
  tr.appendChild(blank);
  
  menu.sync();

  // table body
  let tbody = document.createElement('TBODY');
  table.appendChild(tbody);
  for (let j = 0; j < ids.length; j++) {
    let id = ids[j];
    trans.row(id, data);
  }
}

trans.select = function(id, c) {
  if (!user.user_id) {
    trans.auth();
    return;
  }
  if (user.session && !user.consent) {
    trans.profile();
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
    req = {'func':'setLabel','id':tr.id,'label':u};
  else
    req = {'func':'setText','id':tr.id,'lang':header,'string':u};
  
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

trans.resize = function() {
  if (!table.rows[0])
    return;
  let n = table.rows[0].cells.length - 1;
  let size = (95/n)+'vw';
  //if (user.admin)
    //size = (95/(ncols - 1))+'vw';
  for (let i = 0, row; row = table.rows[i]; i++) {
    for (let j = 0, col; col = row.cells[j]; j++) {
      let s = size;
      if (j == 0)
        s = '5vw';
      col.style['width'] = s;
      col.style['min-width'] = s;
      col.style['max-width'] = s;
    }
  }
}

trans.load = function() {
  if (!user)
    user = { user_id:0, username:'anonymous', session:0 };
  user.admin = user.admin == '1';

  let rid = params.get('r');
  if (rid == null)
    rid = 0;

  if (rid == 'profile' || !user.consent) {
    if (user.session) {
      trans.profile(true);
      return;
    }
  }
  let langs = params.get('c');
  // edit specified languages
  langs = langs.replace(/,/g,'-').split('-');
  trans.edit(rid, langs, true);
}

// logged in?
let session = params.get('s');
if (session) {
  // validate session
  let req = [{'func':'getUser','session':session}];
  trans.get(req, function(code, res) {
    if (code == 200) {
      let json = JSON.parse(res);
      if (json && json[0]) {
        user = json[0];
        user.consent = user.consent == '1';
        user.credit = user.credit == '1';
      }
    }
    trans.load();
  });
} else {
  // guest
  trans.load();
}