---
contractType: "BAA_NEGOTIATOR"
title: "Acuerdo de socio comercial HIPAA (BAA): guía y modelo"
description: "El BAA de la HIPAA explicado: plazos de aviso de incidentes y brechas, acceso y rectificación, resolución, devolución de PHI y límites de responsabilidad."
heading: "Acuerdo de socio comercial de la HIPAA (BAA)"
summary: "El acuerdo de socio comercial (Business Associate Agreement, BAA) es el contrato que exige la normativa estadounidense HIPAA cuando un proveedor crea, recibe, conserva o transmite información sanitaria protegida (PHI) por cuenta de una entidad cubierta o de otro socio comercial. La versión de Dealroom es un BAA preventivo y de activación condicionada, pensado para servicios que no están diseñados para tratar PHI: sus obligaciones solo se aplican si la PHI llega efectivamente al proveedor."
related: ["data-processing-agreement", "saas-agreement", "master-services-agreement", "privacy-notice"]
faq:
  - q: "¿Cuándo es obligatorio un BAA de la HIPAA?"
    a: "Cuando un proveedor crea, recibe, conserva o transmite PHI por cuenta de una entidad cubierta o de un socio comercial. Si el proveedor no accede nunca a PHI, el BAA no es obligatorio, y firmarlo de todos modos no es una protección gratuita, porque conlleva obligaciones."
  - q: "¿En qué plazo debe comunicar el proveedor una brecha de PHI?"
    a: "La norma federal (45 CFR 164.410(b)) exige comunicarla sin demora indebida y, en ningún caso, más tarde de 60 días naturales desde su descubrimiento. Ningún contrato puede ampliar ese límite. Dealroom ofrece cinco días hábiles, diez días naturales o treinta días naturales, siempre como plazo máximo y no como derecho a esperar."
  - q: "¿Qué es un BAA de activación condicionada?"
    a: "Es un BAA para un servicio que no está diseñado para tratar PHI. El cliente se compromete a no enviarla, y las obligaciones del acuerdo solo se activan si el proveedor la recibe de hecho. Si el servicio trata PHI por diseño o de forma habitual, este modelo no es el instrumento adecuado y hace falta un BAA convencional."
  - q: "¿Un BAA de la HIPAA cumple también el RGPD?"
    a: "No. Un BAA conforme a la HIPAA no cumple el artículo 28 del RGPD, y un contrato de encargo del tratamiento conforme al RGPD no cumple 45 CFR 164.504(e). Si pueden llegar al proveedor datos personales de personas de la UE o del EEE, se necesita el BAA más un anexo RGPD o un contrato de encargo independiente."
  - q: "¿Puede un BAA limitar la responsabilidad del proveedor?"
    a: "Entre las dos empresas, sí. Dealroom ofrece tres posiciones: el límite ordinario del contrato de servicios, un límite reforzado del doble de ese importe para fallos de seguridad y brechas del proveedor, o responsabilidad ilimitada por conducta dolosa. Ningún límite afecta a la responsabilidad directa del proveedor frente a la Administración estadounidense."
---

## Qué es y cuándo se utiliza

El acuerdo de socio comercial (BAA, por sus siglas en inglés) es el contrato que exigen las normas de la HIPAA (45 CFR partes 160 y 164) entre una entidad cubierta, como un prestador sanitario o un plan de salud, y un proveedor que trata información sanitaria protegida (PHI) por su cuenta. La misma estructura se aplica un nivel más abajo, entre un socio comercial y su propio subcontratista.
El BAA de Dealroom está pensado para una situación concreta: un servicio que **no está diseñado para tratar PHI** y que se firma como precaución porque el cliente opera en el sector sanitario. El acuerdo declara que el servicio no requiere PHI, que el proveedor no la solicita ni la acepta y que las obligaciones solo se aplican si la PHI llega efectivamente al proveedor. Por eso se denomina BAA de activación condicionada ("springing BAA").

Antes de elegir ninguna opción, la skill plantea una pregunta previa: ¿es el BAA el instrumento adecuado?

- Si el proveedor no accede nunca a PHI, el BAA no es obligatorio.
- Si el servicio trata PHI por diseño o de forma habitual, este modelo no sirve y la operación necesita un BAA convencional.
- El Departamento de Salud estadounidense (HHS) admite tanto un BAA independiente como unas cláusulas incorporadas al contrato de servicios. Este es independiente y se apoya en el contrato de servicios (el "Contrato Subyacente") para la responsabilidad, las notificaciones y el fuero.

## Quién lo firma y en qué condición

Lo firman dos partes:

- **Company (socio comercial):** el proveedor que presta los servicios.
- **Customer (entidad cubierta o socio comercial de nivel superior):** la organización sanitaria, o el socio comercial que contrata al proveedor y actúa como cliente.

En la relación con un subcontratista, "Company" es el subcontratista y "Customer" el socio comercial de nivel superior.

## Cláusulas principales

### Protecciones fijas

Varias secciones no varían. Obligan al cliente a hacer esfuerzos razonables para no enviar PHI (obligación esencial) y regulan qué ocurre si llega por error: el proveedor avisa en cinco días hábiles, la borra o la devuelve y queda liberado respecto de ella. También cubren los subcontratistas, los usos permitidos, las medidas de seguridad, el mínimo necesario, el registro de comunicaciones (entregado en quince días), el acceso del HHS a los registros del proveedor, la mitigación y la adaptación a cambios normativos.

### Aviso de incidentes de seguridad

El proveedor da un aviso único y permanente sobre los intentos de ataque fallidos (rastreos de puertos, inicios de sesión fallidos, denegaciones de servicio), para que ninguna de las partes reciba avisos innecesarios. Los incidentes con éxito deben comunicarse en el plazo pactado. La norma no fija un número para este aviso: todas las opciones, incluidas las 72 horas, son práctica de mercado.

### Aviso de brecha

Fija la rapidez con que el proveedor comunica una brecha de PHI no protegida. La definición de "descubrimiento" es la de la norma federal, incluido el conocimiento atribuido al personal del proveedor. El cliente realiza la evaluación de riesgos y las notificaciones a los interesados, a los medios y al HHS, con la colaboración del proveedor. Si la PHI se envió incumpliendo el compromiso de no enviarla y el proveedor no tuvo culpa, los costes razonables corren a cargo del cliente.

### Acceso y rectificación de la PHI

Si el proveedor conserva PHI en un conjunto de registros designado, debe ponerla a disposición del cliente para que este atienda la solicitud de una persona que quiere ver o corregir sus datos. Las solicitudes dirigidas directamente al proveedor se remiten al cliente.

### Duración y resolución

El cliente puede resolver el BAA y el contrato de servicios por incumplimiento grave si el proveedor no lo subsana en el plazo pactado, o de inmediato si la subsanación no es posible. El proveedor dispone de un plazo fijo de treinta días para resolver si el cliente incumple, por ejemplo enviando PHI de forma consciente o reiterada.

### Devolución o destrucción de la PHI

Al terminar, el proveedor devuelve o destruye la PHI que aún conserve. Si no es posible, las protecciones se mantienen mientras la conserve. La mera conveniencia empresarial no hace imposible la devolución o la destrucción.

### Indemnidad y limitación de responsabilidad

El cliente mantiene indemne al proveedor frente a reclamaciones causadas por enviar PHI en contra de lo pactado. En lo demás, rigen las indemnidades y los límites del contrato de servicios, y la negociación se centra en cómo se limitan los fallos de seguridad y las brechas imputables al proveedor.

## Qué suelen negociar las partes

Cada cláusula negociable tiene tres posiciones. Cuando las partes discrepan, Dealroom propone la posición equilibrada como punto intermedio.

- **Aviso de incidentes:** Company prefiere siete días hábiles y Customer, 72 horas; el punto intermedio son **cinco días hábiles**.
- **Aviso de brecha:** Company prefiere treinta días naturales (muy favorable para el proveedor) o diez; el punto intermedio, y la opción más corta, son **cinco días hábiles**.
- **Acceso de la persona interesada:** Company prefiere treinta o veinte días naturales; el punto intermedio, y la opción más corta, son **quince días naturales**.
- **Rectificación de la PHI:** Company prefiere cuarenta y cinco días naturales y Customer, veinte; el punto intermedio son **treinta días naturales**.
- **Plazo de subsanación antes de la resolución:** Company prefiere cuarenta y cinco días naturales y Customer, quince; el punto intermedio son **treinta días naturales**.
- **Devolución o destrucción de la PHI:** Company prefiere sesenta días naturales y Customer, treinta; el punto intermedio son **cuarenta y cinco días naturales**.
- **Responsabilidad:** Company prefiere el límite ordinario del contrato de servicios y Customer, responsabilidad ilimitada por conducta dolosa; el punto intermedio es un **límite reforzado del doble del límite ordinario** para fallos de seguridad, usos o comunicaciones indebidas y brechas causadas por el proveedor.

El proveedor busca tiempo para investigar, subsanar y depurar copias de seguridad. El cliente quiere saber pronto, conservar margen dentro de sus propios plazos legales y recuperar los costes de una brecha, que suelen superar un límite basado en los honorarios.

El punto intermedio no es justo en todos los casos. Si el proveedor actúa como agente del cliente, se entiende que el cliente descubre la brecha cuando la descubre el proveedor, y cada día de plazo del proveedor se descuenta de los 60 días que tiene el cliente para avisar a los interesados. En ese caso, el cliente tiene motivos para exigir un plazo mucho más corto.

## Jurisdicciones e idiomas que Dealroom admite

Dealroom ofrece este BAA para **California** y solo en **inglés**: el contrato se redacta en inglés, aunque esta guía lo explica en español. La HIPAA es una ley federal y el acuerdo no depende de ningún estado concreto: lleva por defecto la ley de California, sin perjuicio de la primacía del derecho federal. Las controversias se someten al fuero designado en el contrato de servicios o, a falta de designación, a los tribunales estatales y federales del estado cuya ley rija el acuerdo. Las partes deben confirmarlo antes de usarlo.

## Errores frecuentes

- **Usar el modelo condicionado para un servicio que trata PHI de forma habitual.** Sus mecanismos (el compromiso de no enviar PHI, la vía de recepción involuntaria, el traslado de costes) se vuelven entonces contra el cliente.
- **Tratar los 60 días como un plazo negociable para avisar de una brecha.** Es el límite máximo federal, y el aviso debe darse además sin demora indebida.
- **Elegir treinta días para el acceso.** Consume todo el plazo de treinta días del cliente para responder a la persona interesada y lo deja pendiente de su única prórroga. La skill señala esta opción, y la de treinta días para brechas, como opciones que requieren una advertencia.
- **Permitir que la definición restringida de "descubrimiento" de los incidentes rija el aviso de brechas.** La cláusula de brechas sigue vinculada a la definición federal.
- **Pactar un plazo que el proveedor no puede trasladar a sus subcontratistas.** Un número que no se puede trasladar es una promesa vacía.
- **Cifras en letra y en número que no coinciden**, como "cuarenta y cinco (15)" días. Ese error crea una ambigüedad que una de las partes puede aprovechar en el momento de la resolución.
- **Suponer que el BAA cubre datos personales de la UE o del EEE.** No cumple el RGPD; hace falta un anexo o un [contrato de encargo del tratamiento](/es/contracts/data-processing-agreement) independiente.
- **Entender que el límite de responsabilidad reduce lo que pueden reclamar las personas o los reguladores.** El límite solo reparte los costes entre las dos empresas.
