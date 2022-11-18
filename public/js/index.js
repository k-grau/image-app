function showname () {
    const displayName = document.getElementById('displayName');
    const name = document.getElementById('image');
    displayName.innerHTML = name.files.item(0).name; 
  };
