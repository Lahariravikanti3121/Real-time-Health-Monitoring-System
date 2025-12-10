function apiPost(path, body){
  return fetch('http://localhost:5000'+path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }).then(r=>r.json());
}

function apiGet(path){
  return fetch('http://localhost:5000'+path).then(r=>r.json());
}
