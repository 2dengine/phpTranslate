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

// window history (back/forward buttons)
window.onpopstate = function(e){
  let s = e.state;
  if (s && s.eval)
    eval(s.eval);
};

var trans = {};

trans.response = function(xhr, func, ignore) {
  if (xhr.readyState == 4) {
    let json = null;
    try { json = JSON.parse(xhr.responseText); } catch(e) {};
    if (!ignore) {
      if (xhr.status != 200 || !json) {
        let msg = (json) ? json[0] : xhr.responseText;
        trans.error(xhr.status, msg);
        return;
      }
    }
    func(xhr.status, json);
  }
}

trans.post = function(req, func, ignore) {
  if (req.length == 0) return;
  var query = JSON.stringify(req);
  query = encodeURIComponent(query);
  let session = params.get("s");
  let xhr = new XMLHttpRequest();
  xhr.open('POST', 'request/', true);
  xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
  xhr.onreadystatechange = function() {
    trans.response(xhr, func, ignore);
  }
  xhr.send(`&q=${query}&s=${session}`);
}

trans.get = function(req, func, ignore) {
  if (req.length == 0) return;
  var query = JSON.stringify(req);
  query = encodeURIComponent(query);
  let time = new Date().getTime();
  let xhr = new XMLHttpRequest();
  xhr.open('GET', `request/?q=${query}&t=${time}`, true);
  xhr.setRequestHeader('Content-type', 'text/xml');
  xhr.onreadystatechange = function() {
    trans.response(xhr, func, ignore);
  }
  xhr.send();
}

trans.remove = function(ids) {
  var n = ids.length;
  if (n == 0) return;
  if (confirm('Delete '+n+' items?') != true)
    return;
  let pid = params.get("r");
  var req =
  [
    {'func':'getPath','id':pid},
    {'func':'deleteTerms','ids':ids}
  ]
  trans.post(req, function(code, json) {
    // response
    if (code != 200)
      return;
    if (ids.indexOf(pid) != -1) {
      let langs = params.get('c');
      langs = langs.replace(/,/g,'-').split('-');
      trans.edit(json[0][0].id, langs, false);
      return;
    }
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
  trans.get([req], function(code, json) {
    if (code == 200 && json) {
      window.location.href = json[0];
    }
  });
}

trans.signout = function() {
  // request
  let req = { 'func':'logout' };
  trans.post([req], function(code, res) {
    params.delete('s');
    params.delete('r');
    window.location.href = url.href;
  });
}

trans.home = function(replace) {
  // response
  params.delete('r');
  params.delete('c');
  let st = { eval:`javascript:trans.home(true);` };
  let func = (replace) ? 'replaceState' : 'pushState';
  window.history[func](st, '', url.pathname+url.search);

  let req = [
    { 'func':'getTerms', 'ids':[0], 'children':1 },
    { 'func':'getTexts', 'ids':[0], langs:[base], 'children':1 },
    { 'func':'getPage', 'file':'home' }
  ];
  
  trans.get(req, function(code, json) {
    let title = "Common Game Translations";
    let count = json[0].length;
    let header = trans.breadcrumbs(title, '../', `${count} projects found`);
    
    // build page
    let cont = document.createElement('DIV');
    cont.innerHTML = json[2];
    trans.page(title, header, cont);
    
    let main = document.getElementById("projects");
    for (let i = 0; i < json[0].length; i++) {
      let v = json[0][i];
      let div = document.createElement('H3');
      div.innerHTML = `<img src="img/table.png" alt="Project" />`;
      let a = document.createElement('A');
      a.href = `javascript:trans.project(${v.id})`;
      for (let j = 0; j < json[1].length; j++) {
        let w = json[1][j];
        if (w.id == v.id)
          a.textContent = w.string || w.label || w.id;
      }
      div.appendChild(a);
      let owner = v.alias || v.username || 'anonymous';
      let span = document.createElement('SPAN');
      span.textContent = ` by ${owner}`;
      div.appendChild(span);
      main.appendChild(div);
    }
    if (user && user.user_id != '0') {
      let admin = document.getElementById('admin');
      admin.style['display'] = 'block';
    }
  });
}

trans.newProject = function() {
  let name = prompt("Please enter a project title in English:");
  if (!name) return;
  let req = {'func':'appendTerm','parent_id':0,'label':'project'};
  trans.post([req], function(code, json) { 
    if (code != 200) return;
    let id = json[0];
    let set = {'func':'setText','id':id,'lang':'en','string':name};
    trans.post([set], function(code, res) {
      //trans.project(id);
      trans.edit(id, ['en','en'], false);
    });
  });
}

trans.auth = function() {
  modal.style.display = 'block';
}

trans.cancel = function() {
  modal.style.display = 'none';
}

trans.error = function(code, msg) {
  let title = parseInt(code)+' Error';
  let div = document.createElement('DIV');
  div.className = 'padded';
  div.textContent = msg;
  trans.page(title, title, div);
}

trans.project = function(pid, replace) {
  params.delete('c');
  params.set('r', pid);
  let st = { eval:`javascript:trans.project(${pid}, true);` };
  let func = (replace) ? 'replaceState' : 'pushState';
  window.history[func](st, '', url.pathname+url.search);

  let all = [];
  for (let k in locales)
    all.push(k);

  let req = [
    { 'func':'getTerms', 'ids':[pid], 'children':0 },
    { 'func':'getTexts', 'ids':[pid], langs:[base], 'children':0 },
    { 'func':'getTexts', 'ids':[pid], langs:all, 'children':1 },
    { 'func':'getPage', 'file':'project' }
  ];
  
  trans.get(req, function(code, json) {
    let proj = json[0][0];
    if (!pid || !proj)
      return trans.home();

    let title = json[1][0].string;
    let owner = proj.alias || proj.username;
    let created = timediff(proj.created);
    let header = trans.breadcrumbs(title, `javascript:trans.home()`, `Created by ${owner} ${created}`);
    
    // build page
    let cont = document.createElement('DIV');
    cont.innerHTML = json[3];
    cont = project.stats(pid, json[2]);
    trans.page(title, header, cont);
  });
}

trans.edit = function(pid, langs, replace) {
  pid = parseInt(pid);
  if (!pid) return trans.home();
  params.set('r', pid);
  params.set('c', langs.join('-'));
  let cc = '["'+langs.join('","')+'"]';
  let st = { eval:`javascript:trans.edit(${pid}, ${cc}, true);` };
  let func = (replace) ? 'replaceState' : 'pushState';
  window.history[func](st, '', url.pathname+url.search);
  // build
  let rlangs = [...langs];
  if (rlangs.indexOf(base) == -1)
    rlangs.unshift(base);
  let req = [
    { 'func':'getTerms', 'ids':[pid], 'children':1 },
    { 'func':'getTexts', 'ids':[pid], 'langs':rlangs, 'children':1 },
    { 'func':'getPath','id':pid },
    { 'func':'getPage', 'file':'table' }
  ];
  
  trans.get(req, function(code, json) {
    // document title
    let header = 'Common Game Translations';
    let title = header;
    let proj = json[0][0];
    if (!proj)
      return trans.home();
    let rows = json[1];
    let path = json[2];

    if (path && path.length > 0) {
      let parent = parseInt(path[path.length - 1].parent_id);
      let head = header;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].id == pid && rows[i].locale == base) {
          head = rows[i].string;
          break;
        }
      }
      let owner = proj.alias || proj.username;
      let created = timediff(proj.created);
      let link;
      if (parent)
        link = `javascript:trans.edit(${parent}, ${cc}, false)`;
      else
        link = `javascript:trans.project(${pid})`;
      header = trans.breadcrumbs(head, link, `Created by ${owner} ${created}`);
      title = `${head} - ${title}`;
    }

    // build page
    let cont = document.createElement('DIV');
    cont.innerHTML = json[3];
    trans.page(title, header, cont);

    sheet.build(pid, langs, rows, json[0]);
  });
}

trans.breadcrumbs = function(title, link, desc) {
  let img = document.createElement('IMG');
  img.src = 'img/back.png';
  img.alt = 'Back';
  img.className = 'icon';
  let back = document.createElement('A');
  back.href = link;
  back.appendChild(img);
  let h1 = document.createElement('H1');
  h1.appendChild(back);
  h1.appendChild(document.createTextNode(title));
  let node = document.createElement('DIV');
  node.appendChild(h1);
  if (desc) {
    if (typeof desc === 'string' || desc instanceof String)
      desc = document.createTextNode(desc);
    node.appendChild(desc);
  }
  return node;
}

trans.profile = function(replace) {
  params.set('r', 'profile');
  params.delete('c');
  let st = { eval:`javascript:trans.profile(true);` };
  let func = (replace) ? 'replaceState' : 'pushState';
  window.history[func](st, '', url.pathname+url.search);
  
  let session = params.get('s');
  var req =
  [
    {'func':'getPage','file':'profile'},
    {'func':'getUser','session':session}
  ];
  trans.get(req, function(code, json) {
    user = json[1];
    
    let title = 'Edit Profile';
    let header = trans.breadcrumbs('Profile', 'javascript:trans.home();', 'Edit your public profile information');
    let cont = document.createElement('DIV');
    cont.innerHTML = json[0];

    trans.page(title, header, cont);

    const alias = document.getElementById('alias');
    const credit = document.getElementById('credit');
    if (user.alias) {
      credit.checked = true;
      alias.value = user.alias; 
    } else {
      credit.checked = false;
      alias.disabled = true;
    }
    const agree = document.getElementById('agreement');
    const cb = document.getElementById('consent');
    let msg = '';
    if (!user.consent) {
      agree.className = 'padded error';
      msg = '(Required)';
    } else {
      cb.checked = true;
      cb.disabled = true;
      msg = '(Accepted '+timediff(user.consent)+')';
    }
    agree.appendChild(document.createTextNode(msg));
      
    var req = {'func':'requestKeys'};
    trans.post([req], function(code, json) {
      let list = json[0];
      if (list && list.length > 0) {
        const keys = document.getElementById('keys');
        const keys_list = document.getElementById('keys_list');
        keys.style['display'] = 'block';
        for (let i = 0; i < list.length; i++)
          keys_list.innerHTML += `<a href="javascript:trans.project(${list[i].project});">${list[i].steam_key}</a>\n`;
      }
    });
  });
}

trans.syncme = function(e) {
  let reload = false;
  let req = [];
  const consent = document.getElementById('consent');
  if (!user.consent && consent.checked) {
    reload = true;
    req.push({'func':'giveConsent'});
  }
  const credit = document.getElementById('credit');
  const alias = document.getElementById('alias');
  alias.disabled = !credit.checked;
  if (alias.value && !credit.checked)
    alias.value = '';
  if (user.alias != alias.value)
    req.push({'func':'setAlias','alias':alias.value});
  trans.post(req, function(code, res) {
    // response
    if (reload)
      trans.profile(true);

    user.alias = alias.value;
    let u = document.getElementById('username');
    u.textContent = user.alias || 'anonymous';
  });
}

trans.unregister = function() {
  if (!confirm("Delete your account and contributions?"))
    return;
  let verify = prompt("Please type in the word \"delete\" to delete your account and permanently remove your contributions");
  if (verify && verify == "delete") {
    var req = {'func':'unregister','user':user.user_id};
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
  // avatar image and username
  let avatar = 'img/nouser.jpg';
  if (user && user.avatar)
    avatar = user.avatar;
  var imgs = document.getElementsByClassName("avatar");
  for (var i = 0; i < imgs.length; i++)
    imgs.item(i).src = avatar;

  let u = document.getElementById('username');
  u.textContent = 'anonymous';
  if (user)
    u.textContent = user.alias || user.username;
  let profile = 'javascript:trans.auth();';
  let link = profile;
  let anchor = 'Login';
  if (user && user.user_id != '0') {
    profile = 'javascript:trans.profile(false);';
    link = 'javascript:trans.signout();';
    anchor = 'Logout';
  }
  var links = document.getElementsByClassName('profile');
  for (var i = 0; i < links.length; i++)
    links.item(i).href = profile;
  let action = document.getElementById('action');
  action.textContent = anchor;
  action.href = link;

  // header
  let div = document.getElementById('title');
  if (typeof header === 'string' || header instanceof String) {
    let h1 = document.createElement('H1');
    h1.textContent = header;
    header = h1;
  }
  while (div.firstChild)
    div.removeChild(div.firstChild);
  div.appendChild(header);

  // body
  //cont.className = 'content';
  page.appendChild(cont);
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

trans.load = function() {
  if (!user)
    user = { user_id:'0', username:'anonymous', session:0 };

  let rid = params.get('r');
  if (rid == null)
    rid = 0;
  let langs = params.get('c');

  if (rid == 'profile' || (user.user_id != '0' && !user.consent)) {
    trans.profile(true);
    return;
  }
  if (langs) {
    langs = langs.replace(/,/g,'-').split('-');
    trans.edit(rid, langs, true);
    return;
  }
  trans.project(rid, true);
}

// logged in?
let session = params.get('s');
if (session) {
  // validate session
  let req = [{'func':'getUser','session':session}];
  trans.get(req, function(code, json) {
    if (code == 200)
      if (json && json[0])
        user = json[0];
    trans.load();
  }, true);
} else {
  // guest
  trans.load();
}