// AURUM AGENTS — WalletConnect diagnostic (preview only).
// Tests relay reachability and lists/clears WalletConnect localStorage keys.
// No transaction, no signing, no wallet connection.
(function () {
  var wsEl = document.getElementById("ws");
  var wsDetail = document.getElementById("ws-detail");
  var keysEl = document.getElementById("keys");
  var keysDetail = document.getElementById("keys-detail");

  function listWcKeys() {
    var out = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("wc@2") === 0) out.push(k);
    }
    return out;
  }

  function showKeys() {
    var keys = listWcKeys();
    keysEl.textContent = keys.length + " keys";
    keysDetail.textContent = keys.length ? keys.join(", ") : "none stored";
  }
  showKeys();

  var opened = false;
  var s;
  try {
    s = new WebSocket("wss://relay.walletconnect.com");
  } catch (e) {
    wsEl.textContent = "ERROR (could not start)";
    wsDetail.textContent = String(e && e.message ? e.message : e);
    return;
  }
  s.onopen = function () {
    opened = true;
    wsEl.textContent = "OPEN";
    wsDetail.textContent = "This browser CAN reach the WalletConnect relay.";
  };
  s.onerror = function () {
    if (!opened) {
      wsEl.textContent = "ERROR";
      wsDetail.textContent = "This browser CANNOT reach the WalletConnect relay (network or extension is blocking it).";
    }
  };
  s.onclose = function () {
    if (!opened) {
      wsEl.textContent = "CLOSED";
      wsDetail.textContent = "Connection closed before opening (readyState " + s.readyState + ").";
    }
  };
  setTimeout(function () {
    wsDetail.textContent += " readyState after 5s: " + s.readyState + " (0=connecting, 1=open, 2=closing, 3=closed).";
  }, 5000);

  document.getElementById("clear").addEventListener("click", function () {
    var keys = listWcKeys();
    keys.forEach(function (k) {
      localStorage.removeItem(k);
    });
    document.getElementById("clear-result").textContent =
      " Cleared " + keys.length + " WalletConnect keys.";
    showKeys();
  });
})();
