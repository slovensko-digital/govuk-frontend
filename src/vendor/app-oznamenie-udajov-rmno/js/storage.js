

var storageKey = 'RMNOData';
window.storage = {
load: function(elementId, selector){
  const element = document.getElementById(elementId);
  element.value = selector(this.get()) || '';
},

edit: function(editor){
  var data = this.get();
  data = editor(data);
  localStorage.setItem(storageKey, JSON.stringify(data));
},

get: function(){

  return JSON.parse(localStorage.getItem(storageKey))
}
}

storage.edit(data => {

  var out = data;
  if (!out){
    out = {};
  }
  if (!out.org){
    out.org = {}
  }
  if (!out.persons){
    out.persons = []
  }
  return out
})