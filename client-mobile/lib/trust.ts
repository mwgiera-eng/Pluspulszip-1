export const TRUST_SECTIONS = [
  { id: "accessibility", label: "Dostępność", title: "Accessibility statement", items: [
    ["Standard", ["PlusPuls pracuje w kierunku WCAG 2.2 Level AA: postrzegalność, obsługa, zrozumiałość i odporność.", "Podstawy obejmują czytelną strukturę, widoczny fokus, kontrast, redukcję ruchu oraz etykiety, które nie opierają się wyłącznie na kolorze."]],
    ["Maps and live data", ["Animowane sygnały ruchu są uzupełnieniem. Najważniejsze stany mają także etykiety Flow, Heavy i Jam.", "Zgłoś problem dostępności, jeśli mapa lub inna funkcja blokuje korzystanie z PlusPuls."]],
  ] },
  { id: "privacy", label: "Prywatność", title: "Privacy notice", items: [
    ["Data", ["W zależności od użytych funkcji PlusPuls może przetwarzać dane konta i kontaktowe, lokalizację, aktywność, przejazdy i zarobki, referencje płatności, preferencje alertów i zgłoszenia.", "Zbieramy dane potrzebne do działania wybranej funkcji. Lokalizacja jest używana dopiero po decyzji użytkownika i może pozostać wyłączona."]],
    ["Purposes", ["Cele obejmują świadczenie usługi, uwierzytelnianie, bezpieczeństwo, analizy dla kierowcy, preferencje, wsparcie, niezawodność i obowiązki prawne."]],
    ["Sharing and retention", ["Dostawcy infrastruktury, bazy danych i płatności mogą obsługiwać dane tylko w zakresie potrzebnym do świadczenia usługi. Informacje o dostawcach i okresach retencji muszą być aktualizowane wraz z integracjami."]],
  ] },
  { id: "cookies", label: "Sesja", title: "Cookie and session policy", items: [
    ["Essential", ["Bezpieczne cookie lub równoważna pamięć jest potrzebna do logowania, ciągłości sesji i ochrony konta.", "Aplikacja nie zapisuje hasła ani danych płatniczych."]],
  ] },
  { id: "terms", label: "Warunki", title: "Terms of use", items: [
    ["Decision support", ["PlusPuls dostarcza informacje wspierające decyzje. Ruch, popyt, wydarzenia, trasy, zarobki i prognozy mogą być opóźnione, szacowane lub niepełne i nie gwarantują kursów ani przychodu.", "Kierowca odpowiada za przepisy, bezpieczeństwo i zasady platform. Nie obsługuj aplikacji w sposób rozpraszający podczas jazdy."]],
    ["Accounts and use", ["Chroń dane logowania. Nie uzyskuj dostępu do cudzych danych, nie omijaj zabezpieczeń i nie automatyzuj szkodliwego ruchu."]],
    ["Independence", ["PlusPuls jest niezależnym narzędziem i nie jest oficjalną usługą platform przewozowych, o ile nie opublikowano pisemnego partnerstwa."]],
  ] },
  { id: "conduct", label: "Kodeks", title: "Code of conduct", items: [
    ["Respect", ["Niedopuszczalne są nękanie, dyskryminacja, groźby, odwet, oszustwo, podszywanie się, celowa dezinformacja i ujawnianie cudzych danych prywatnych."]],
    ["Safety and integrity", ["Nie używaj PlusPuls do zachęcania do niebezpiecznej jazdy, obchodzenia prawa, manipulowania rynkiem ani utrudniania innym dostępu do pracy."]],
  ] },
  { id: "speak-up", label: "Zgłoszenia", title: "Speak-up and reporting", items: [
    ["How to report", ["Użyj funkcji Zgłoś problem dla spraw związanych z zachowaniem, prywatnością, bezpieczeństwem, dostępnością lub integralnością.", "Nie przesyłaj haseł, danych płatniczych ani kodów uwierzytelniających."]],
    ["Urgent situations", ["Kanał nie jest służbą alarmową. Przy bezpośrednim zagrożeniu skorzystaj z właściwych lokalnych służb."]],
  ] },
  { id: "modern-slavery", label: "Prawa człowieka", title: "Modern slavery statement", items: [
    ["Commitment", ["PlusPuls nie toleruje pracy przymusowej, handlu ludźmi ani wykorzystywania w swojej działalności lub łańcuchu dostaw.", "Ryzyka dostawców powinny być oceniane proporcjonalnie do skali usługi, dostępu do danych i lokalizacji działalności."]],
    ["Reporting", ["Podejrzenia można zgłaszać przez kanał Zgłoś problem. Zgłoszenia w dobrej wierze nie powinny prowadzić do odwetu."]],
  ] },
  { id: "company", label: "O PlusPuls", title: "Company and service information", items: [
    ["Service", ["PlusPuls to niezależne narzędzie wspierające decyzje kierowców na podstawie danych o ruchu, popycie, wydarzeniach i lotach.", "Dane operatora, adres do korespondencji oraz właściwe informacje konsumenckie muszą zostać uzupełnione przed publiczną sprzedażą."]],
  ] },
] as const;

export type TrustSectionId = typeof TRUST_SECTIONS[number]["id"];
