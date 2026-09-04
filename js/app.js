(function () {
  "use strict";
  var texts = [];
  for (var i = 0; i < 3; i++) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "js/app.part" + i + ".txt", false);
    xhr.send(null);
    if (xhr.status !== 200 && xhr.status !== 0) {
      throw new Error("CardFitSG failed to load js/app.part" + i + ".txt (HTTP " + xhr.status + ")");
    }
    texts.push(xhr.responseText);
  }
  (0, eval)(texts.join(""));
})();
