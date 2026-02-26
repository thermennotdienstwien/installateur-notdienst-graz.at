
(() => {
  const qs = (sel, root = document) => root.querySelector(sel);

  const loadScriptOnce = (() => {
    const cache = new Map();
    return (src) => {
      if (cache.has(src)) return cache.get(src);
      const p = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.defer = true;
        s.onload = () => resolve(true);
        s.onerror = () => reject(new Error("Script load failed: " + src));
        document.head.appendChild(s);
      });
      cache.set(src, p);
      return p;
    };
  })();

  function getValue(form, name) {
    const el = form.querySelector(`[name="${CSS.escape(name)}"]`);
    return el ? String(el.value ?? "").trim() : "";
  }

  function setIfMissing(fd, key, value) {
    if (!value) return;
    const existing = String(fd.get(key) ?? "").trim();
    if (!existing) fd.set(key, value);
  }

  function initForm(form) {
    if (!form) return;

    const btn = qs('button[type="submit"]', form);
    const spinner = btn ? qs('[role="status"]', btn) : null;

    const privacy = qs("#privacy", form) || qs('[name="Datenschutz"]', form);

    const feedback = qs("[data-form-feedback]", form);
    const feedbackTitle = feedback ? qs("[data-form-feedback-title]", feedback) : null;
    const feedbackText = feedback ? qs("[data-form-feedback-text]", feedback) : null;
    const box = feedback ? feedback.firstElementChild : null;

    const siteKey = form.dataset.recaptcha || "";
    let recaptchaLoaded = false;

    const showMsg = (type, title, text) => {
      if (!feedback || !box) return;

      feedback.classList.remove("hidden");

      box.classList.remove(
        "bg-white/60",
        "bg-red-100",
        "bg-green-100",
        "border-red-300",
        "border-green-300",
        "border-white/30"
      );

      if (type === "success") box.classList.add("bg-green-100", "border-green-300");
      else if (type === "error") box.classList.add("bg-red-100", "border-red-300");
      else box.classList.add("bg-white/60", "border-white/30");

      if (feedbackTitle) feedbackTitle.textContent = title || "";
      if (feedbackText) feedbackText.textContent = text || "";
    };

    const hideMsg = () => {
      if (!feedback) return;
      feedback.classList.add("hidden");
      if (feedbackTitle) feedbackTitle.textContent = "";
      if (feedbackText) feedbackText.textContent = "";
    };

    const setLoading = (isLoading) => {
      if (spinner) spinner.classList.toggle("invisible", !isLoading);
      if (btn) btn.disabled = isLoading || (privacy ? !privacy.checked : false);
    };

    const enableState = async () => {
      if (!btn) return;
      hideMsg();

      if (privacy && !privacy.checked) {
        btn.disabled = true;
        return;
      }

      if (siteKey && !recaptchaLoaded) {
        recaptchaLoaded = true;
        try {
          await loadScriptOnce(
            "https://www.google.com/recaptcha/api.js?render=" + encodeURIComponent(siteKey)
          );
        } catch (_) {
        }
      }

      btn.disabled = false;
    };

    if (privacy) privacy.addEventListener("change", enableState);
    enableState();

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideMsg();

      if (privacy && !privacy.checked) {
        showMsg(
          "error",
          "Bitte bestätigen Sie den Datenschutz.",
          "Ohne Zustimmung können wir Ihre Anfrage leider nicht absenden."
        );
        return;
      }

      setLoading(true);
      showMsg("info", "Wird gesendet…", "Bitte einen Moment warten.");

      try {
        let token = "";
        if (siteKey) {
          if (!window.grecaptcha) {
            showMsg(
              "error",
              "reCAPTCHA konnte nicht geladen werden.",
              "Bitte versuchen Sie es erneut oder deaktivieren Sie ggf. Script-Blocker."
            );
            setLoading(false);
            return;
          }

          token = await new Promise((resolve, reject) => {
            window.grecaptcha.ready(() => {
              window.grecaptcha
                .execute(siteKey, { action: "kontakt" })
                .then(resolve)
                .catch(reject);
            });
          });
        }

        const fd = new FormData(form);

        // Senin HTML isimleri -> run.php'nin bekledikleri:
        setIfMissing(fd, "name", getValue(form, "Ansprechpartner"));
        setIfMissing(fd, "mail", getValue(form, "email"));
        setIfMissing(fd, "tel", getValue(form, "Telefonnummer"));
        setIfMissing(fd, "adresse", getValue(form, "Adresse"));
        setIfMissing(fd, "nachricht", getValue(form, "Nachricht"));

        if (privacy && privacy.checked) fd.set("tos", "1");

        if (token) fd.set("g-recaptcha-response", token);

        // 3) AJAX POST
        const res = await fetch(form.action, { method: "POST", body: fd });
        const text = await res.text().catch(() => "");

        if (res.ok) {
          showMsg(
            "success",
            "Vielen Dank!",
            (text || "Vielen Dank für Ihre Anfrage! Wir melden uns in Kürze.").trim()
          );
          form.reset();
          enableState(); 
          setLoading(false);
          return;
        }

        showMsg(
          "error",
          "Es ist ein Fehler aufgetreten.",
          (text || `Anfrage konnte nicht gesendet werden (HTTP ${res.status}).`).trim()
        );
        enableState();
        setLoading(false);
      } catch (err) {
        showMsg(
          "error",
          "Es ist ein Fehler aufgetreten.",
          "Die Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder rufen Sie uns an."
        );
        enableState();
        setLoading(false);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll("form[data-contact-form]").forEach(initForm);
  });
})();