import { sb, tila } from "../db.js";
import { $, esc, ilmoita } from "../util.js";

const paluu = () => location.origin + location.pathname;

export async function nayta(main) {
  if (tila.valmentaja) { location.hash = "#/"; return; }
  main.innerHTML = `
    <h1>Kirjaudu</h1>
    <p class="ingressi">Pelaajakohtaiset tulokset ja tulosten syöttö ovat valmentajien käytössä. Kirjaudu Google-tilillä tai sähköpostiin lähetettävällä linkillä.</p>
    ${tila.istunto ? `<div class="paneeli" style="max-width:520px;margin-bottom:16px"><strong>Olet kirjautunut osoitteella ${esc(tila.istunto.user.email)},</strong> mutta sitä ei ole valmentajien listalla. Pyydä ylläpitäjää lisäämään osoite.</div>` : ""}
    <div class="paneeli" style="max-width:520px;display:grid;gap:18px">
      <button class="btn ensisij" id="google" style="justify-content:center;padding:12px">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Kirjaudu Googlella</button>
      <form id="linkki" style="display:grid;gap:8px">
        <label class="kentta">Tai sähköpostilla
          <input type="email" required autocomplete="email" placeholder="nimi@esimerkki.fi" id="email"></label>
        <button class="btn" type="submit">Lähetä kirjautumislinkki</button>
      </form>
    </div>`;
  $("#google").onclick = async () => {
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: paluu() } });
    if (error) ilmoita("Google-kirjautuminen ei ole vielä käytössä. Käytä sähköpostilinkkiä.", true);
  };
  $("#linkki").onsubmit = async (e) => {
    e.preventDefault();
    const email = $("#email").value.trim().toLowerCase();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: paluu(), shouldCreateUser: true } });
    if (error) ilmoita("Linkin lähetys epäonnistui: " + error.message, true);
    else $("#linkki").innerHTML = `<p><strong>Linkki lähetetty osoitteeseen ${esc(email)}.</strong> Avaa se samalla laitteella ja selaimella.</p>`;
  };
}
