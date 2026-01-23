/*
  # Add Terms of Service and Privacy Policy Editable Texts

  ## Overview
  This migration adds editable text entries for Terms of Service (Regulamin) and Privacy Policy (Polityka Prywatności)
  to the ui_texts table, enabling admins to edit these documents through the CMS.

  ## Changes Made
  
  ### ui_texts Table
  - Add `terms_of_service` entry with default Polish terms of service content
  - Add `privacy_policy` entry with default Polish privacy policy content

  ## Security
  - Uses existing RLS policies on ui_texts table
  - Only admins can edit these texts
  - All authenticated users can read them

  ## Important Notes
  - These texts will be displayed in modals on the frontend
  - Admins can edit them directly through the admin interface
  - HTML formatting is supported in the content field
*/

-- Insert Terms of Service (Regulamin)
INSERT INTO ui_texts (element_id, content) VALUES
  ('terms_of_service', 
  '<h3>1. Postanowienia ogólne</h3>
<p>Platforma Evair służy do wymiany informacji, organizacji wydarzeń oraz komunikacji między użytkownikami społeczności lotniczej. Korzystając z platformy, akceptujesz niniejszy regulamin.</p>

<h3>2. Kultura wypowiedzi</h3>
<p>Wszyscy użytkownicy zobowiązani są do kulturalnego zachowania, szanowania innych uczestników oraz przestrzegania zasad netykiety. Zabrania się:</p>
<ul>
  <li>Używania wulgarnego języka i obraźliwych treści</li>
  <li>Publikowania treści niezgodnych z prawem</li>
  <li>Nękania innych użytkowników</li>
  <li>Spam''u i reklamy bez zgody administratora</li>
</ul>

<h3>3. Prywatność danych</h3>
<p>Twoje dane osobowe są chronione zgodnie z obowiązującymi przepisami RODO. Szczegóły w Polityce Prywatności.</p>

<h3>4. Odpowiedzialność</h3>
<p>Administrator platformy nie ponosi odpowiedzialności za treści publikowane przez użytkowników. Zastrzegamy sobie prawo do usunięcia treści naruszających regulamin.</p>

<h3>5. Zmiany regulaminu</h3>
<p>Administrator zastrzega sobie prawo do wprowadzania zmian w regulaminie. O istotnych zmianach użytkownicy zostaną poinformowani.</p>')
ON CONFLICT (element_id) DO NOTHING;

-- Insert Privacy Policy (Polityka Prywatności)
INSERT INTO ui_texts (element_id, content) VALUES
  ('privacy_policy', 
  '<h3>1. Administrator danych</h3>
<p>Administratorem danych osobowych użytkowników platformy Evair jest [nazwa organizacji], z siedzibą w Warszawie przy ul. Kaliskiego 57.</p>

<h3>2. Zakres zbieranych danych</h3>
<p>W ramach korzystania z platformy zbieramy następujące dane:</p>
<ul>
  <li>Imię i nazwisko</li>
  <li>Adres e-mail</li>
  <li>Zdjęcie profilowe (opcjonalnie)</li>
  <li>Dane dotyczące aktywności na platformie</li>
</ul>

<h3>3. Cel przetwarzania danych</h3>
<p>Dane osobowe przetwarzane są w celu:</p>
<ul>
  <li>Świadczenia usług platformy społecznościowej</li>
  <li>Komunikacji z użytkownikami</li>
  <li>Zapewnienia bezpieczeństwa platformy</li>
  <li>Realizacji obowiązków prawnych</li>
</ul>

<h3>4. Udostępnianie danych</h3>
<p>Dane osobowe mogą być udostępniane wyłącznie:</p>
<ul>
  <li>Innym użytkownikom platformy (imię, nazwisko, zdjęcie profilowe)</li>
  <li>Dostawcom usług IT wspierającym działanie platformy</li>
  <li>Organom uprawnionym na podstawie przepisów prawa</li>
</ul>

<h3>5. Prawa użytkowników</h3>
<p>Użytkownikom przysługuje prawo do:</p>
<ul>
  <li>Dostępu do swoich danych osobowych</li>
  <li>Sprostowania danych</li>
  <li>Usunięcia danych (prawo do bycia zapomnianym)</li>
  <li>Ograniczenia przetwarzania</li>
  <li>Przenoszenia danych</li>
  <li>Wniesienia sprzeciwu wobec przetwarzania</li>
</ul>

<h3>6. Cookies</h3>
<p>Platforma wykorzystuje pliki cookies w celu zapewnienia prawidłowego działania i poprawy komfortu użytkowania.</p>

<h3>7. Kontakt</h3>
<p>W sprawach związanych z ochroną danych osobowych można kontaktować się poprzez formularz kontaktowy na platformie.</p>')
ON CONFLICT (element_id) DO NOTHING;
