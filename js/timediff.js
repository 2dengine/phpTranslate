function timediff(s) {
  if (!s)
    return 'never';
  // difference in seconds
  let d1 = new Date();
  let d2 = new Date();
  d1.setTime(s*1000);
  let t1 = d1.getTime()/1000;
  let t2 = d2.getTime()/1000;
  let sa = Math.abs(t1 - t2);
  if (sa < 60) {
    sa = Math.floor(sa);
    let sd = (t1 < t2) ? -sa : sa;
		if (sd >= 2) return "in " + sa + " seconds";
		else if (sd == 1) return "in 1 second";
		else if (sd == 0) return "just now";
		else if (sd == -1) return "1 second ago";
		else return sa + " seconds ago";
  }
  // difference in minutes
  let na = sa/60;
  if (na < 60) {
    na = Math.floor(na);
    let nd = (t1 < t2) ? -na : na;
		if (nd >= 2) return "in " + na + " minutes";
		else if (nd == 1) return "in 1 minute";
		else if (nd == 0) return "this minute";
		else if (nd == -1) return "1 minute ago";
		else return na + " minutes ago";
  }
  // difference in hours
  let ha = na/60;
  if (ha < 24) {
    ha = Math.floor(ha);
    let hd = (t1 < t2) ? -ha : ha;
		if (hd >= 2) return "in " + ha + " hours";
		else if (hd == 1) return "in 1 hour";
		else if (hd == 0) return "this hour";
		else if (hd == -1) return "1 hour ago";
		else return ha + " hours ago";
  }
	// difference in days (Julian)
	let j1 = Math.floor((t1/86400.0) + 2440587.5);
	let j2 = Math.floor((t2/86400.0) + 2440587.5);
	let jd = j1 - j2;
	if (jd > -30 && jd < 30) {
		if (jd >= 2) return "in " + jd + " days";
		else if (jd == 1) return "tomorrow";
		else if (jd == 0) return "today";
		else if (jd == -1) return "yesterday";
		else return -jd + " days ago";
	}
	// difference in years
	let y1 = d1.getUTCFullYear();
	let y2 = d2.getUTCFullYear();
	let yd = y1 - y2;
	// difference in months
	let m1 = d1.getUTCMonth();
	let m2 = d2.getUTCMonth();
	let md = (m1 - m2) + (yd*12);
	if (md > -12 && md < 12) {
		if (md >= 2) return "in " + md + " months";
		else if (md == 1) return "next month";
		else if (md == 0) return "this month";
		else if (md == -1) return "last month";
		else return -md + " months ago";
	} else {
		if (yd >= 2) return "in " + yd + " years";
		else if (yd == 1) return "next year";
		else if (yd == 0) return "this year";
		else if (yd == -1) return "last year";
		else return -yd + " years ago";
	}
}