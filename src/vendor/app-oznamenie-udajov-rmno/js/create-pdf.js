
function createPdf(data){
	function th (t){
		return ({text: t, style: 'tableHeader'})
	}
	function ds (t){
		return {text: t, style: 'dataLine'};
	}
var documentDefinition = {
	header: {text: `${data.org.name}, IČO: ${data.org.cin}, VVS/${data.org.vvs}`, style: 'pageHeader'},
	footer: function(currentPage, pageCount) { return (pageCount > 1) ? {text: currentPage.toString() + ' / ' + pageCount, style: 'pageFooter'} : null; },
	content: [
{columns: [
	{width: '*', text: ''},
	{width: '200', text: 'Ministerstvo vnútra SR \n sekcia verejnej správy \nodbor všeobecnej vnútornej správy \noddelenie registrácií \nDrieňová 22\n 826 86 Bratislava 29 ', alignment: 'left'},
]},
{text: 'Vec:'},
{text: 'Oznámenie aktuálnych údajov o štatutárnom orgáne alebo členoch štatutárneho orgánu občianskeho združenia', alignment: 'center', style: 'header'},
{text: ['Podľa § 20a ods. 1 zákona č. 83/1990 Zb. o združovaní občanov v znení neskorších predpisov Vám oznamujeme,',
'že štatutárnym orgánom združenia s názvom ', {text: data.org.name, style: 'data'},
 ' IČO: ',{text: data.org.cin, style: 'data'}, ' registrovaného Ministerstvom vnútra SR dňa ',
 {text: data.org.dateOfReg, style: 'data'}, ' pod č. VVS/',
 {text: data.org.vvs, style: 'data'}, ' je:']},
 'Tabulka:',
 {
	style: ['tableOfPersons'],
	table: {
		headerRows: 1,
		body: [
			['Meno a priezvisko', 'Adresa trvalého pobytu', 'Dátum narodenia', 'Rodné číslo', 'Deň vzniku funkcie'].map(th),
			...data.persons.map(p => [p.name, p.address, p.dateOfBirth, p.rc, p.dateStart])
		]
	}
},
'Vedla seba:',
...data.persons.map(p => ({
	style: ['personDetail'],
		stack: [
			{text: ['Meno a priezvisko: ',ds(p.name),]},
			{text: ['Adresa trvalého pobytu: ',ds(p.address),]},
			{text: ['Dátum narodenia: ',ds(p.dateOfBirth),]},
			{text: ['Rodné číslo: ',ds(p.rc),]},
			{text: ['Deň vzniku funkcie: ',ds(p.dateStart),]},
	]})),
	'Pod sebou:',
...data.persons.map(p => ({
	style: ['personDetail'],
		stack: [
			{stack: ['Meno a priezvisko: ',ds(p.name),]},
			{stack: ['Adresa trvalého pobytu: ',ds(p.address),]},
			{stack: ['Dátum narodenia: ',ds(p.dateOfBirth),]},
			{stack: ['Rodné číslo: ',ds(p.rc),]},
			{stack: ['Deň vzniku funkcie: ',ds(p.dateStart),]},
	]}))
	],
	styles: {
		header: {
			fontSize: 18,
			bold: true,
			margin: [10, 10, 10, 10]
		},
		subheader: {
			fontSize: 16,
			bold: true,
			margin: [0, 10, 0, 5]
		},
		tableOfPersons: {
			margin: [10, 20]
		},
		personDetail: {
			margin: [20, 10, 5, 10]
		},
		tableHeader: {
			bold: true,
			fontSize: 13,
			color: 'black'
		},
		data: {
			bold: true,
			fontSize: 14
		},
		dataLine: {
			bold: true,
			fontSize: 14,
			margin: [10, 0, 0, 6],
		},
		pageHeader: {
			alignment: 'center',
			margin: 10,
		},
		pageFooter: {
			alignment: 'center',
			margin: 5,
		}

	},
	defaultStyle: {
		alignment: 'left'
	},
	pageSize: 'A4',

	pageOrientation: 'portrait',
	pageMargins: [ 40, 40],
	
}
return documentDefinition;
}

document.querySelector('.getpdf').addEventListener('click', function(){	


	const dd = createPdf(storage.get());
	pdfMake.createPdf(dd).open();


		/* 
		const data = {
		org: {
			name: "OZ meno zdruzenia",
			cin: '4343434343',
			vvs: "123-123/123",
			dateOfReg: "21.12.1233"

		},
		persons: [
			{
				name: "Jakub Kakub",
				address: "Kakubcova 322, Midwest",
				dateOfBirth: "21.12.1221",
				rc: "123123/9090",
				dateStart: "21.12.1444",
			},{
				name: "Jakubbbbbbbbbbbbbbbbb Kakub",
				address: "Kakubcova 322, Midwest",
				dateOfBirth: "21.12.1221",
				rc: "123123/9090",
				dateStart: "21.12.1444",
			},{
				name: "Jakub Kakub",
				address: "Kakubcova 322, Midwest",
				dateOfBirth: "21.12.1221",
				rc: "123123/9090",
				dateStart: "21.12.1444",
			},{
				name: "Jakub Kakub",
				address: "Kakubcovaaaaaaaaaaaaaaa 322, Midwest",
				dateOfBirth: "21.12.1221",
				rc: "123123/9090",
				dateStart: "21.12.1444",
			},{
				name: "Jakub Kakub",
				address: "Kakubcova 322, Midwest",
				dateOfBirth: "21.12.1221",
				rc: "123123/9090",
				dateStart: "21.12.1444",
			},
		]
		
	}*/
})
