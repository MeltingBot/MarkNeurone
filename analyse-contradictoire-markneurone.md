# MarkNeurone : analyse contradictoire

Cette note examine les objections sérieuses que l'on peut opposer au plugin de lecture annotée décrit dans la note de cadrage, puis les réponses qu'on peut y apporter. Pour chaque objection, j'indique si elle me paraît levée, atténuable ou bloquante.

## 1. Le coût en temps de l'annotation manuelle

**Objection.** Un enquêteur qui reçoit une procédure de 300 pages, des réponses à réquisitions et des relevés bancaires ne surlignera pas tout à la main. Même à deux secondes par geste, un document dense produit plusieurs centaines d'annotations, et le temps cumulé dépasse celui d'une saisie directe sur le canvas pour les seuls éléments utiles. L'outil risque d'être adopté sur les cinq premières pages puis abandonné.

**Réponse.** L'usage visé n'est pas l'annotation exhaustive. L'enquêteur lit déjà le document, et le plugin capture ce qu'il aurait noté de toute façon, avec la source en prime. La comparaison pertinente se fait avec le couple lecture puis ressaisie manuelle dans ZN, pas avec une extraction automatique. Sur ce terrain le gain est plausible, mais il n'est pas démontré.

**Élément nouveau.** Les analystes criminels de la Gendarmerie prétraitent déjà les PV par surlignage selon un code couleur, puis ressaisissent les entités dans leur outil de graphe. Le plugin ne crée donc pas un geste supplémentaire pour ce public : il reprend un geste existant et supprime la ressaisie.

**Statut : largement levé pour le public Anacrim, atténuable pour les autres.** La mesure de temps avec et sans plugin reste utile, mais la comparaison se fera désormais avec la méthode surlignage puis ressaisie, ce qui joue en faveur du plugin.

## 2. La nature réelle des documents

**Objection.** Une grande partie des pièces d'enquête ne sont pas de la prose. Les fadettes, relevés bancaires, réponses d'opérateurs et extractions de registres sont des tableaux, souvent livrés en PDF généré ou scanné. La détection de liens par phrase ne fonctionne pas sur un tableau, et la couche texte de PDF.js restitue mal les colonnes, ce qui fausse la sélection et l'ordre de lecture. Les procès-verbaux scannés, fréquents en contexte judiciaire, n'ont aucune couche texte.

**Réponse.** Les tableaux relèvent d'un import structuré (CSV, XLSX, ou extraction de tableau) que ZN gère ou devrait gérer par un autre canal. MarkNeurone vise la prose : auditions, rapports, articles de presse, statuts de société, décisions de justice, échanges de courriels. Ce périmètre reste large en OSINT.

**Élément nouveau.** Les PV sont désormais diffusés en PDF image, sans couche texte. Sans OCR, le plugin est inutilisable sur la pièce centrale du public visé.

**Statut : bloquant sans OCR, d'où son passage en V1.** La note de cadrage intègre maintenant une OCR locale à la demande par zone et complète en arrière-plan. Le périmètre doit tout de même rester affiché clairement : les tableaux relèvent d'un import structuré, et les mentions manuscrites ne seront pas lues.

## 2 bis. La qualité de l'OCR

**Objection.** L'OCR introduit une source d'erreur que la lecture humaine n'avait pas. Un 0 lu comme un O dans un numéro de téléphone fait rater un recoupement, et un chiffre mal reconnu dans une plaque crée un véhicule fictif. Sur des PV photocopiés plusieurs fois, numérisés en biais ou tamponnés, le taux d'erreur peut rendre la correction plus longue que la saisie directe. Le temps de traitement d'une procédure volumineuse dans un navigateur, sur un poste de service modeste, peut aussi décourager l'usage.

**Réponse.** L'analyste voit toujours l'extrait d'image à côté du texte reconnu et valide après correction. Les identifiants à clé de contrôle signalent eux-mêmes les erreurs de lecture, et les caractères de faible confiance sont mis en évidence. L'OCR à la demande par zone permet de travailler sans attendre la fin du traitement complet. Les PV dactylographiés récents sont par ailleurs un cas favorable pour Tesseract.

**Statut : à tester en priorité.** C'est désormais la principale incertitude technique du projet. Un test sur une dizaine de PV réels anonymisés, de qualités diverses, mesurant le taux d'erreur sur les identifiants et le temps de traitement par page, doit précéder tout développement d'interface.

## 3. Le biais de confirmation induit par le pré-surlignage

**Objection.** Le dictionnaire du dossier surligne en couleur les éléments déjà connus. L'œil de l'enquêteur va naturellement vers ces repères et glisse sur le reste. Le plugin renforce alors l'hypothèse de travail en cours au détriment des éléments nouveaux, qui sont justement ceux qu'une relecture devrait faire émerger. Les suggestions de cooccurrence amplifient l'effet en proposant des liens entre entités déjà suivies.

**Réponse.** Le problème existe sans le plugin, et le recoupement visible entre pièces a une vraie valeur. On peut le compenser en rendant le pré-surlignage désactivable par défaut lors d'une première lecture, ou en proposant un mode « première lecture » sans aucune suggestion, puis un mode « recoupement » qui les affiche.

**Statut : atténuable.** Le point mérite d'être traité dans l'ergonomie, car il touche directement la qualité analytique que ZN revendique.

## 4. La validation par lassitude

**Objection.** Le discours du plugin repose sur le contrôle humain : rien n'entre dans le graphe sans validation. En pratique, face à cinquante suggestions sur une page, l'utilisateur valide en série. La validation devient un geste réflexe qui donne un vernis de contrôle humain à une extraction automatique. Le risque augmente si les suggestions OneNeurone transitent par le même canal, car le plugin servirait alors à blanchir des sorties IA sous l'étiquette « validé par l'analyste ».

**Réponse.** La traçabilité de l'origine (`origin: 'oneneurone'`, `'pattern'`, `'manual'`) reste conservée après validation, ce qui permet de distinguer dans le graphe ce qui vient d'une lecture humaine et ce qui vient d'une suggestion acceptée. On peut aussi interdire la validation en masse et imposer un geste par suggestion.

**Statut : atténuable, mais l'argument commercial doit rester modeste.** Je retirerais de la communication toute formule laissant entendre que la validation garantit la qualité de l'extraction. Elle garantit seulement qu'un humain a vu passer l'objet.

## 5. Les homonymes et les fusions abusives

**Objection.** La correspondance par dictionnaire avec tolérance sur casse, accents, initiales et inversion nom/prénom va rattacher « J. Martin » du document B à « Jean Martin » du dossier, alors qu'il s'agit peut-être de Jacques Martin. Dans une enquête sur personne, une fusion abusive produit une fausse piste et peut conduire à mettre en cause quelqu'un à tort. Le coût d'une erreur est bien supérieur au gain de temps.

**Réponse.** Le rattachement à un élément existant doit rester une proposition, jamais un comportement par défaut. Le formulaire peut afficher les candidats possibles avec leurs propriétés discriminantes (date de naissance, adresse) et proposer par défaut la création d'un nouvel élément quand la correspondance n'est pas exacte.

**Statut : bloquant si mal conçu, levé si la règle est stricte.** C'est le point que je mettrais en tête des tests.

## 6. Les liens que la phrase ne contient pas

**Objection.** En français, la relation est souvent portée par une anaphore : « Le gérant a rencontré M. Duval. Il lui a ensuite remis une enveloppe. » Le mode verbe sur la seconde phrase ne trouve aucun élément qualifié à gauche ni à droite. La cooccurrence par phrase manque le lien, et la cooccurrence par paragraphe en produit trop. Les relations les plus intéressantes, souvent implicites ou réparties sur plusieurs pages, échappent aux trois modes proposés.

**Réponse.** Le mode deux clics fonctionne quelle que soit la distance entre les éléments, et l'utilisateur sait résoudre une anaphore sans aide. Les modes assistés couvrent les cas simples, et le mode manuel reste disponible pour le reste.

**Statut : levé pour l'usage, mais la promesse des modes assistés doit être revue à la baisse.** Je m'attends à ce que le mode deux clics porte l'essentiel des liens réels.

## 7. La valeur probante revendiquée

**Objection.** L'empreinte SHA-256 prouve que le fichier n'a pas changé depuis l'annotation. Elle ne prouve rien sur la fidélité de l'annotation au document, sur le choix du libellé de relation ni sur l'interprétation. Présenter l'ancre comme une garantie en procédure expose à une contestation par la défense, qui pourra montrer que le graphe reformule le texte source.

**Réponse.** L'ancre a pour fonction de permettre la vérification, pas de remplacer le document. Un magistrat ou un avocat peut cliquer sur chaque objet et lire le passage d'origine, ce qui est plus vérifiable qu'un graphe saisi à la main sans référence.

**Statut : levé si le vocabulaire est ajusté.** Parler de « référence à la source » et de « contrôle d'intégrité du fichier », pas de preuve.

## 8. Le positionnement face à OneNeurone

**Objection.** Un plugin gratuit et efficace réduit l'intérêt de payer OneNeurone. À l'inverse, s'il est volontairement limité pour protéger l'offre payante, il paraîtra bridé et nuira à l'image open source de ZN. La proposition de format commun pousse aussi à une dépendance technique entre un plugin MIT et un produit commercial.

**Réponse.** Les deux outils ne servent pas le même moment du travail. OneNeurone traite le volume que personne ne lira, MarkNeurone sert la lecture attentive des pièces qui comptent. Le format commun peut être documenté comme une spécification ouverte que n'importe quel extracteur peut produire, y compris un outil tiers ou un script local.

**Statut : atténuable.** La question relève de la stratégie produit plus que de la technique. Il faut trancher avant le développement, car elle détermine ce qui entre dans la V1 gratuite.

## 9. L'existant

**Objection.** Des outils d'annotation de documents avec extraction d'entités existent déjà, côté renseignement comme côté recherche (i2 a proposé des fonctions de conversion de texte en graphe, et des outils d'annotation comme Hypothesis ou Recogito couvrent une partie du besoin). Le plugin risque de réinventer une fonction mal maintenue à long terme par un projet porté par une seule personne.

**Réponse.** L'intérêt tient à l'intégration native dans un graphe local-first, sans ontologie imposée et sans envoi de données vers un service tiers. Aucun outil d'annotation grand public ne produit directement des éléments ZN avec leurs ancres. Un état de l'art rapide reste nécessaire pour vérifier ce point et récupérer de bonnes idées d'ergonomie.

**Statut : à vérifier.** Pour le public Anacrim, la question se pose surtout face à Analyst's Notebook, qui reste leur outil de graphe principal. Si le résultat du prétraitement ne peut pas rejoindre ANB, le plugin oblige à une double saisie et perd son intérêt. Un export compatible .anb devient alors une condition d'adoption, pas une option.

## 10. Le contre-argument pédagogique

**Objection inverse.** Pour les stagiaires du DU ou les formations Gendarmerie, l'annotation manuelle oblige à lire, à qualifier et à justifier chaque objet. Cet usage pourrait être le plus solide de tous, car la lenteur y devient une qualité.

**Réponse.** C'est probablement le premier public où l'outil trouvera sa place sans discussion. Il permet aussi de comparer la grille d'annotation d'un stagiaire avec un corrigé, à condition de prévoir un export et une comparaison d'annotations.

**Statut : argument favorable.** Il peut justifier à lui seul le MVP.

## Synthèse

La pratique de surlignage des PV par les Anacrim renforce nettement l'intérêt du plugin, puisqu'il numérise une méthode existante au lieu d'en imposer une. En contrepartie, le passage des PV en PDF image fait de l'OCR le cœur technique du projet.

Trois points restent potentiellement bloquants : la qualité de l'OCR sur des PV réels, les fusions abusives par le dictionnaire et la compatibilité avec Analyst's Notebook. Le premier se mesure par un test sur pièces anonymisées, le deuxième se règle par une règle de conception stricte, et le troisième se vérifie auprès d'analystes en poste.

Les objections sur le biais de confirmation, la validation par lassitude et la valeur probante concernent surtout le discours. Le plugin reste défendable si la communication s'en tient à ce qu'il fait réellement, à savoir capturer une lecture humaine avec sa référence à la source.

Je proposerais de commencer par le test OCR, qui peut se faire avec un simple script avant toute interface. Viendrait ensuite un test sur deux dossiers, l'un composé de PV et l'un mixte, en chronométrant la construction du graphe avec le plugin et avec la méthode actuelle de surlignage suivi de ressaisie. Ce test donnerait aussi le taux de liens créés par chacun des trois modes, ce qui indiquerait si les modes assistés méritent la V2.
