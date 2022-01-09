var project = {}

project.stats = function(pid, rows) {
  let data = {};
  for (let k in locales)
    data[k] = { locale: k, count: 0, updated: 0, contrib:{}, terms:{} };

  for (let i = 0; i < rows.length; i++) {
    let v = rows[i];
    let d = data[v.locale];
    //if (d.terms[v.id])
      //continue;
    d.terms[v.id] = v;
    d.count ++;
    d.updated = Math.max(d.updated, v.posted);
    let a = d.contrib[v.poster_id];
    if (!a) {
      let name = v.alias || v.username || 'anonymous';
      a = { name: name, posts: 0 };
      d.contrib[v.poster_id] = a;
    }
    a.posts ++;
  }
  let list = [];
  for (let k in data) {
    let v = data[k];
    list.push(v);
    let c = [];
    for (let j in v.contrib)
      c.push(v.contrib[j]);
    c.sort(function(a, b) {
      return b.posts - a.posts;
    });
    v.contrib = c;
  }
  list.sort(function(a, b) {
    //return (b.count - a.count) + 1/(b.updated - a.updated);
    return (b.updated - a.updated) + 1/(b.count - a.count);
  });

  let div = document.createElement('DIV');
  div.className = 'padded';

  let max = 0;
  let bmax = 0;
  for (let i = 0; i < list.length; i++) {
    let v = list[i];
    max = Math.max(max, v.count);
    if (v.locale == base)
      bmax = v.count;
  }

  for (let i = 0; i < list.length; i++) {
    let v = list[i];

    let e = document.createElement('DIV');
    e.className = "column hpadded";
    if (v.count == 0)
      e.className += " error";
    else if (v.count < bmax)
      e.className += " warning";
    else
      e.className += " text";
    div.appendChild(e);
    
    let since = timediff(v.updated);
    let right = document.createElement('DIV');
    right.className = 'center';
    right.style['float'] = 'right';
    right.style['width'] = '150px';
    right.innerHTML = `<b>${v.count}/${bmax}</b><br>${since}`;
    e.appendChild(right);
    
    let n = locales[v.locale][0];
    e.innerHTML += `<b><a href='javascript:trans.edit(${pid}, ["en","${v.locale}"], false)'>${n}</a></b>`;

    let q = document.createElement('DIV');
    q.style['width'] = '100%';
    let users = [];
    for (let i = 0; i < v.contrib.length; i++) {
      let w = v.contrib[i];
      users.push(`${w.name} (${w.posts})`);
    }
    let u = document.createTextNode(users.join(', '));
    q.appendChild(u);
    q.innerHTML += '&nbsp;';
    e.appendChild(q);
  }
  return div;
}