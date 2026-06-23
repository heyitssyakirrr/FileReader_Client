/**
 * upload.js — Single-file upload logic
 *
 * Reads window.EXTRACTION_ENDPOINT (injected by the HTML template) so this
 * file is environment-agnostic and never hardcodes any URL.
 *
 * Behaviour (per plan Section 9):
 *   1. File selected → Submit button enabled.
 *   2. Submit clicked → POST to /extract/single, button + input disabled.
 *   3. success:true  → show "Successfully Uploaded" for 5 s, then reset.
 *   4. success:false → show server's message for 5 s, then reset.
 *   5. Network error → show generic message for 5 s, then reset.
 *   6. Reset is always a soft in-page state clear — never location.reload().
 */

(function () {
    "use strict";

    /* ------------------------------------------------------------------
       Element refs
    ------------------------------------------------------------------ */
    var fileInput  = document.getElementById("fileInput");
    var submitBtn  = document.getElementById("submitBtn");
    var spinner    = document.getElementById("spinner");
    var btnLabel   = document.getElementById("btnLabel");
    var statusMsg  = document.getElementById("statusMessage");

    /* ------------------------------------------------------------------
       State
    ------------------------------------------------------------------ */
    // Prevents firing a second request while one is already in flight,
    // even though the button is disabled during submission (belt-and-braces).
    var isSubmitting = false;

    // Holds the pending auto-reset timer so rapid calls to scheduleReset
    // don't stack up multiple timers running in parallel.
    var resetTimer = null;

    /* ------------------------------------------------------------------
       File selection → enable / disable Submit
    ------------------------------------------------------------------ */
    fileInput.addEventListener("change", function () {
        submitBtn.disabled = !fileInput.files.length || isSubmitting;
    });

    /* ------------------------------------------------------------------
       Submit click
    ------------------------------------------------------------------ */
    submitBtn.addEventListener("click", function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file || isSubmitting) return;

        // Client-side type guard — the server validates too, but this
        // avoids a round-trip for an obviously wrong file type.
        if (!file.name.toLowerCase().endsWith(".pdf")) {
            showMessage("Only PDF files are supported.", "error");
            scheduleReset();
            return;
        }

        submitFile(file);
    });

    /* ------------------------------------------------------------------
       Core submission (mirrors the plan's suggested shape exactly)
    ------------------------------------------------------------------ */
    async function submitFile(file) {
        setSubmitting(true);

        try {
            var formData = new FormData();
            formData.append("file", file);

            var res  = await fetch(window.EXTRACTION_ENDPOINT, {
                method: "POST",
                body: formData,
            });
            var data = await res.json();

            if (data.success) {
                showMessage("Successfully Uploaded", "success");
            } else {
                // Server returned a structured validation error
                // (unsupported type, file too large, etc.) — show verbatim.
                showMessage(data.message || "Upload failed. Please try again.", "error");
            }
        } catch (err) {
            // Covers: network failure, DNS error, server unreachable,
            // JSON parse error — anything that makes fetch throw.
            showMessage("Could not reach the server. Please try again.", "error");
        }

        // In ALL cases schedule the auto-reset.
        scheduleReset();
    }

    /* ------------------------------------------------------------------
       UI state helpers
    ------------------------------------------------------------------ */

    function setSubmitting(on) {
        isSubmitting         = on;
        submitBtn.disabled   = on;
        fileInput.disabled   = on;
        spinner.classList.toggle("visible", on);
        btnLabel.textContent = on ? "Uploading\u2026" : "Upload";
    }

    function showMessage(text, type) {
        statusMsg.textContent = text;
        // Reset classes first so switching from success→error (or vice
        // versa) never leaves a stale colour class behind.
        statusMsg.className = "message visible " + type;
    }

    function hideMessage() {
        statusMsg.className   = "message";
        statusMsg.textContent = "";
    }

    function resetForm() {
        // Soft in-page reset — no location.reload(), no page flash.
        fileInput.value      = "";    // clears the selected file
        fileInput.disabled   = false;
        submitBtn.disabled   = true;  // disabled again until a new file is chosen
        isSubmitting         = false;
        btnLabel.textContent = "Upload";
        spinner.classList.remove("visible");
    }

    function scheduleReset() {
        // Cancel any pending reset before scheduling a new one so
        // multiple rapid calls can't queue up stacked timers.
        if (resetTimer !== null) {
            clearTimeout(resetTimer);
        }
        resetTimer = setTimeout(function () {
            hideMessage();
            resetForm();
            resetTimer = null;
        }, 5000);
    }

})();
