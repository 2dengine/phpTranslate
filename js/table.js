
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

input.onblur = function() {
  sheet.deselect(true);
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
  //'group': 'Group',
  'approve': 'Approve',
  //'unapprove': 'Unapprove'
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


// translation table
const sheet = {};

sheet.row = function(id, data) {
  let owner = !data || data.label[id].owner_id == user.user_id;
  if (user.admin == '1')
    owner = true;
  
  let table = document.getElementById('table');
  let tr = document.createElement('TR');
  tr.id = id;
  let tbody = table.tBodies[0];
  tbody.appendChild(tr);
  //let isfirst = tbody.firstChild == tr;
  let isfirst = params.get("r") == id;
  // checkbox
  let cb = document.createElement('TD');
  tr.appendChild(cb);
  if (owner) {
    tr.setAttribute('data-selected', 'false');
    cb.setAttribute('data-href', `javascript:trans.toggle(${id}, ${isfirst});`);
    cb.className = 'checkbox';
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
      if (v.posted) {// && v.string) {
        td.title = timediff(v.posted);
        if (owner)
          td.title = (v.alias || v.username || 'anonymous') + '\n' + td.title;
      }
    }
    if (h != 'label' || owner)
      td.setAttribute('data-href', `javascript:sheet.select(${id}, '${i}');`);
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
    td.setAttribute('data-href', `javascript:trans.edit(${id}, ${cc}, false);`);
  }
  //td.textContent += ' '+v.id;
}

sheet.build = function(pid, langs, rows, terms) {
  // terms and labels
  let labels = {};
  for (let i = 0; i < terms.length; i++) {
    let v = terms[i];
    v.string = v.label;
    labels[v.id] = v;
  }
  // arrange as a table
  let data = {};
  data.label = {};
  for (let id in labels)
    data.label[id] = labels[id];
  data[base] = {};
  for (let i = 0; i < langs.length; i++) {
    let v = langs[i];
    data[v] = {};
    for (let k in labels)
      data[v][k] = null;
  }
  for (let i = 0; i < rows.length; i++) {
    let v = rows[i];
    if (v.locale)// && !data[v.locale][v.id])
      data[v.locale][v.id] = v;
  }

  // cells
  let cols = [...langs];
  cols.unshift('label');
  
  // rebuild table
  let table = document.getElementById('table');
  while (table.firstChild)
    table.removeChild(table.firstChild);

  // header
  let thead = document.createElement('THEAD');
  table.appendChild(thead);
  let tr = document.createElement('TR');
  thead.appendChild(tr);

  let th = tr.appendChild(document.createElement('TH'));
  th.className = 'checkbox';
  
  let owner = false;
  if (user.user_id)
    owner = pid == 0 || labels[pid].owner_id == user.user_id || user.admin == '1';

  let n = 0;
  for (let i = 0; i < cols.length; i++) {
    let h = cols[i];
    let th = document.createElement('TH');
    th.headers = h;
    tr.appendChild(th);
    if (h == 'label' && owner) {
      let button = document.createElement('BUTTON');
      button.onclick = function() {
        var req = {'func':'appendTerm','parent_id':pid,'label':''};
        trans.post([req], function(code, json) { 
          if (code != 200) return;
          var id = json[0];
          sheet.row(id);
          var div = table.tBodies[0];
          div.scrollTop = div.scrollHeight - div.clientHeight;
          sheet.resize();
        });
      }
      button.textContent = 'Add Term';
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
  if (user.admin == '1' || user.user_id != '0')
    blank.appendChild(menu);
  tr.appendChild(blank);
  
  menu.sync();

  // table body
  let tbody = document.createElement('TBODY');
  table.appendChild(tbody);
  for (let j = 0; j < terms.length; j++) {
    let id = terms[j].id;
    sheet.row(id, data);
  }
  
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
      sheet.deselect(false);
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
            sheet.select(_tr.id, j);
      }

      return false;
    }
  }

  sheet.resize();
}

sheet.select = function(id, c) {
  if (user.user_id == '0') {
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
  sheet.deselect(true);
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

sheet.deselect = function(update) {
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
  while (td.firstChild)
    td.removeChild(td.firstChild);
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

sheet.resize = function() {
  let table = document.getElementById('table');
  if (!table.rows[0])
    return;
  let n = table.rows[0].cells.length - 1;
  let size = (95/n)+'vw';

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
