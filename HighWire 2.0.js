{
	"translatorID": "8c1f42d5-02fa-437b-b2b2-73afc768eb07",
	"label": "HighWire 2.0",
	"creator": "Matt Burton",
	"target": "^[^?#]+(?:/content/(?:[0-9]+[A-Z\\-]*/(?:suppl_)?[A-Z]?[0-9]|current|firstcite|early)|/search\\?.*?\\bsubmit=|/search(?:/results)?\\?fulltext=|/cgi/collection/.)",
	"minVersion": "3.0",
	"maxVersion": "",
	"priority": 200,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsv",
	"lastUpdated": "2014-06-04 05:08:59"
}

/*
 Translator for several Highwire journals. Example URLs:

1. Ajay Agrawal, Iain Cockburn, and John McHale, “Gone but not forgotten: knowledge flows, labor mobility, and enduring social relationships,” Journal of Economic Geography 6, no. 5 (November 2006): 571-591.
	http://joeg.oxfordjournals.org/content/6/5/571 :
2. Gordon L. Clark, Roberto Durán-Fernández, and Kendra Strauss, “‘Being in the market’: the UK house-price bubble and the intended structure of individual pension investment portfolios,” Journal of Economic Geography 10, no. 3 (May 2010): 331-359.
	http://joeg.oxfordjournals.org/content/10/3/331.abstract
3. Hans Maes, “Intention, Interpretation, and Contemporary Visual Art,” Brit J Aesthetics 50, no. 2 (April 1, 2010): 121-138.
	http://bjaesthetics.oxfordjournals.org/cgi/content/abstract/50/2/121
4. M L Giger et al., “Pulmonary nodules: computer-aided detection in digital chest images.,” Radiographics 10, no. 1 (January 1990): 41-51.
	http://radiographics.rsna.org/content/10/1/41.abstract
5. Mitch Leslie, "CLIP catches enzymes in the act," The Journal of Cell Biology 191, no. 1 (October 4, 2010): 2.
	   http://jcb.rupress.org/content/191/1/2.2.short
*/

function getSearchResults(doc, url, checkOnly) {
	var xpaths = [
		{
			searchx: '//li[contains(@class, "toc-cit") and \
				not(ancestor::div/h2/a/text() = "Correction" or \
					ancestor::div/h2/a/text() = "Corrections")]',
			titlex: './/h4'
		},
		{
			searchx: '//*[contains(@class, "results-cit cit")]',
			titlex: './/*[contains(@class, "cit-title")]'
		},
		{
			searchx: '//div[contains(@class, "is-early-release") or \
				contains(@class, "from-current-issue")] \
				|//div[contains(@class, "toc-level level3")]//ul[@class="cit-list"]/div',
			titlex: './/span[contains(@class, "cit-title")]'
		},
		{
			searchx: '//div[contains(@class,"main-content-wrapper")]\
				//div[contains(@class, "highwire-article-citation")]',
			titlex:	'.//div[contains(@class, "highwire-cite-title")]'
		}
	];
	
	var found = false, items = {},
		linkx = '(.//a[not(contains(@href, "hasaccess.xhtml"))])[1]';
	for(var i=0; i<xpaths.length && !found; i++) {
		var rows = ZU.xpath(doc, xpaths[i].searchx);
		if(!rows.length) continue;
		
		for(var j=0, n=rows.length; j<n; j++) {
			var title = ZU.xpathText(rows[j], xpaths[i].titlex);
			if(!title) continue;
			
			var link = ZU.xpath(rows[j], linkx);
			if(!link.length || !link[0].href) continue;
			
			items[link[0].href] = ZU.trimInternal(title);
			found = true;
			
			if(checkOnly) return true;
		}
	}
	
	if(found) Zotero.debug('Found search results using xpath set #' + (i-1));
	
	return found ? items : null;
}

//get abstract
function getAbstract(doc) {
	//abstract, summary
	var abstrSections = ZU.xpath(doc,
			'//div[contains(@id,"abstract") or @class="abstractSection"]\
			/*[not(contains(@class,"section-nav"))\
				and not(contains(@class,"kwd"))]');

	var abstr = '';
	var paragraph;

	for(var i=0, n=abstrSections.length; i<n; i++) {
		paragraph = abstrSections[i].textContent.trim();

		//ignore the abstract heading
		if( paragraph.toLowerCase() == 'abstract' ||
			paragraph.toLowerCase() == 'summary' ) {
			continue;
		}

		//put all lines of a paragraph on a single line
		paragraph = paragraph.replace(/\s+/g,' ');

		abstr += paragraph + "\n";
	}

	return abstr.trim();
}

//some journals display keywords
function getKeywords(doc) {
	//some journals are odd and don't work with this.
	//e.g. http://jn.nutrition.org/content/130/12/3122S.abstract
	var keywords = ZU.xpath(doc,'//ul[contains(@class,"kwd-group")]//a');
	var kwds = new Array();
	for(var i=0, n=keywords.length; i<n; i++) {
		//don't break for empty nodes
		if(keywords[i].textContent)	kwds.push(keywords[i].textContent.trim());
	}

	return kwds;
}

//mimetype map for supplementary attachments
//intentionally excluding potentially large files like videos and zip files
var suppTypeMap = {
	'pdf': 'application/pdf',
//	'zip': 'application/zip',
	'doc': 'application/msword',
	'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'xls': 'application/vnd.ms-excel',
	'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
};

//attach supplementary information
function attachSupplementary(doc, item, next) {
	var navDiv = doc.getElementById('article-cb-main')
		|| doc.getElementById('article-views')
		|| ZU.xpath(doc, '//div[contains(@class, "cb-section")]')[0]; //http://www.plantphysiol.org/content/162/1/9.abstract
	if(navDiv) {
		var suppLink = ZU.xpath(navDiv, './/a[@rel="supplemental-data"]')[0]
			|| ZU.xpath(doc, '//a[@rel="supplemental-data"]')[0];
		if(suppLink) {
			var attachAsLink = Z.getHiddenPref("supplementaryAsLink");
			if(attachAsLink) {
				item.attachments.push({
					title: "Supplementary info",
					url: suppLink.href,
					mimeType: 'text/html',
					snapshot: false
				});
			} else {
				ZU.processDocuments(suppLink.href, function(newDoc, url) {
					//sciencemag.org
					var container = newDoc.getElementById('sci-bd');
					if(container) {
						var dts = ZU.xpath(container, './dl/dt');
						var dt, dd, title, url, type, snapshot, description;
						for(var i=0, n=dts.length; i<n; i++) {
							dt = dts[i];
							title = ZU.trimInternal(dt.textContent);
							
							dd = dt.nextElementSibling;
							
							if(dd.nodeName.toUpperCase() == 'DD') {
								if(dd.firstElementChild
									&& dd.firstElementChild.nodeName.toUpperCase() == 'UL') {
									description = ZU.xpathText(dd, './ul/li', null, '; ');
								} else {
									description = dd.textContent;
								}
								
								if(description) {
									description = ZU.trimInternal(description)
										.replace(/\s;/g, ';');
										
									if(description.indexOf(title) === 0
										|| title.toUpperCase() == 'DOWNLOAD SUPPLEMENT') {
										title = '';
									} else {
										title += '. ';
									}
									
									title += description;
								}
							}
							
							if(title.toUpperCase() == 'DOWNLOAD SUPPLEMENT') {
								title = 'Supplementary Data';
							}
							
							url = dt.getElementsByTagName('a')[0];
							if(!url) continue;
							url = url.href;
							
							type = suppTypeMap[url.substr(url.lastIndexOf('.')+1).toLowerCase()];
							
							//don't download files with unknown type.
							//Could be large files we're not accounting for, like videos,
							// or HTML pages that we would end up taking snapshots of
							snapshot = !attachAsLink && type;
							
							item.attachments.push({
								title: title,
								url: url,
								mimeType: type,
								snapshot: !!snapshot
							})
						}
						next(doc, item);
						return;
					}
					
					//others
					container = newDoc.getElementById('content-block');
					if(container) {
						var links = ZU.xpath(container, './h1[@class="data-supp-article-title"]\
							/following-sibling::div//ul//a');
					
						var counters = {}, title, tUC, url, type, snapshot;
						for(var i=0, n=links.length; i<n; i++) {
							title = links[i].nextSibling; //http://www.plantphysiol.org/content/162/1/9.abstract
							if(title) {
								title = title.textContent
									.replace(/^[^a-z]+/i, '').trim();
							}

							if(!title) {
								title = ZU.trimInternal(links[i].textContent.trim())
									.replace(/^download\s+/i, '')
									.replace(/\([^()]+\)$/, '');
							}
							
							tUC = title.toUpperCase();
							if(!counters[tUC]) {	//when all supp data has the same title, we'll add some numbers
								counters[tUC] = 1;
							} else {
								title += ' ' + (++counters[tUC]);
							}
							
							url = links[i].href;
							
							//determine type by extension
							type = suppTypeMap[url.substr(url.lastIndexOf('.')+1).toLowerCase()];
							
							//don't download files with unknown type.
							//Could be large files we're not accounting for, like videos,
							// or HTML pages that we would end up taking snapshots of
							snapshot = !attachAsLink && type;
							
							item.attachments.push({
								title: title,
								url: url,
								mimeType: type,
								snapshot: !!snapshot
							});
						}
						next(doc, item);
						return;
					}
				});
				return true;
			}
		}
		return;
	}
}

//add using embedded metadata
function addEmbMeta(doc) {
	var translator = Zotero.loadTranslator("web");
	//Embedded Metadata translator
	translator.setTranslator("951c027d-74ac-47d4-a107-9c3069ab7b48");
	translator.setDocument(doc);

	translator.setHandler("itemDone", function(obj, item) {
		//remove all caps in Names and Titles
		for (i in item.creators){
			//Z.debug(item.creators[i])
			if(item.creators[i].lastName == item.creators[i].lastName.toUpperCase()) {
				item.creators[i].lastName =
					ZU.capitalizeTitle(item.creators[i].lastName, true);
			}
			//we test for existence of first Name to not fail with spotty data. 
			if(item.creators[i].firstName && item.creators[i].firstName == item.creators[i].firstName.toUpperCase()) {
				item.creators[i].firstName =
					ZU.capitalizeTitle(item.creators[i].firstName, true);
			}
		}

		if(item.title == item.title.toUpperCase()) {
			item.title = ZU.capitalizeTitle(item.title,true);
		}

		var abs = getAbstract(doc);
		if(abs) item.abstractNote = abs;

		var kwds = getKeywords(doc);
		if(kwds) item.tags = kwds;

		if (item.notes) item.notes = [];
		
		//try to get PubMed ID and link if we don't already have it from EM
		var pmDiv;
		if((!item.extra || item.extra.search(/\bPMID:/) == -1)
			&& (pmDiv = doc.getElementById('cb-art-pm'))) {
			var pmId = ZU.xpathText(pmDiv, './/a[contains(@class, "cite-link")]/@href')
					|| ZU.xpathText(pmDiv, './ol/li[1]/a/@href');	//e.g. http://www.pnas.org/content/108/52/20881.full
			if(pmId) pmId = pmId.match(/access_num=(\d+)/);
			if(pmId) {
				if(item.extra) item.extra += '\n';
				else item.extra = '';
				
				item.extra += 'PMID: ' + pmId[1];
				
				item.attachments.push({
					title: "PubMed entry",
					url: "http://www.ncbi.nlm.nih.gov/pubmed/" + pmId[1],
					mimeType: "text/html",
					snapshot: false
				});
			}
		}
		
		if(Z.getHiddenPref && Z.getHiddenPref("attachSupplementary")) {
			try {	//don't fail if we can't attach supplementary data
				var async = attachSupplementary(doc, item, function(doc, item) { item.complete() });
			} catch(e) {
				Z.debug("Error attaching supplementary information.")
				Z.debug(e);
				if(async) item.complete();
			}
			if(!async) {
				item.complete();
			}
		} else {
			item.complete();
		}
	});

	translator.translate();
}

function detectWeb(doc, url) {
	var highwiretest = false;

	//quick test for highwire embedded pdf page
	highwiretest = url.indexOf('.pdf+html') != -1;

	//only queue up the sidebar for data extraction (it seems to always be present)
	if(highwiretest && url.indexOf('?frame=sidebar') == -1) {
		return;
	}

	if (!highwiretest) {
		// lets hope this installations don't tweak this...
		highwiretest = ZU.xpath(doc,
				"//link[@href='/shared/css/hw-global.css']|//link[contains(@href,'highwire.css')]").length;
	}
	
	if(highwiretest) {
		if (getSearchResults(doc, url, true)) {
			return "multiple";
		} else if ( url.match("content/(early/)?[0-9]+") && 
					url.indexOf('/suppl/') == -1 ) {
			return "journalArticle";
		}
	}
}

function doWeb(doc, url) {
	if (!url) url = doc.documentElement.location;
	
	var items = getSearchResults(doc, url);
	if(items) {
		Zotero.selectItems(items, function(selectedItems) {
			if(!selectedItems) return true;

			var urls = new Array();
			for( var item in selectedItems ) {
				urls.push(item);
			}

			Zotero.Utilities.processDocuments(urls, addEmbMeta);
		});
	} else if(url.indexOf('.full.pdf+html') != -1) {
		//abstract in EM is not reliable. Fetch abstract page and scrape from there.
		ZU.processDocuments(url.replace(/\.full\.pdf\+html.*/, ''), addEmbMeta);
	} else {
		addEmbMeta(doc);
	}
}
/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://rer.sagepub.com/content/52/2/201.abstract",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Avi",
						"lastName": "Hofstein",
						"creatorType": "author"
					},
					{
						"firstName": "Vincent N.",
						"lastName": "Lunetta",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot"
					}
				],
				"DOI": "10.3102/00346543052002201",
				"language": "en",
				"journalAbbreviation": "REVIEW OF EDUCATIONAL RESEARCH",
				"issue": "2",
				"url": "http://rer.sagepub.com/content/52/2/201",
				"ISSN": "0034-6543, 1935-1046",
				"libraryCatalog": "rer.sagepub.com",
				"abstractNote": "The laboratory has been given a central and distinctive role in science education, and science educators have suggested that there are rich benefits in learning from using laboratory activities. At this time, however, some educators have begun to question seriously the effectiveness and the role of laboratory work, and the case for laboratory teaching is not as self-evident as it once seemed. This paper provides perspectives on these issues through a review of the history, goals, and research findings regarding the laboratory as a medium of instruction in introductory science teaching. The analysis of research culminates with suggestions for researchers who are working to clarify the role of the laboratory in science education.",
				"shortTitle": "The Role of the Laboratory in Science Teaching",
				"title": "The Role of the Laboratory in Science Teaching: Neglected Aspects of Research",
				"date": "06/01/1982",
				"publicationTitle": "Review of Educational Research",
				"volume": "52",
				"pages": "201-217"
			}
		]
	},
	{
		"type": "web",
		"url": "http://sag.sagepub.com/content/early/2010/04/23/1046878110366277.abstract",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Trevor",
						"lastName": "Owens",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot"
					}
				],
				"DOI": "10.1177/1046878110366277",
				"language": "en",
				"journalAbbreviation": "Simulation Gaming",
				"url": "http://sag.sagepub.com/content/early/2010/04/23/1046878110366277",
				"ISSN": "1046-8781, 1552-826X",
				"libraryCatalog": "sag.sagepub.com",
				"abstractNote": "Sid Meier’s CIVILIZATION has been promoted as an educational tool, used as a platform for building educational simulations, and maligned as promoting Eurocentrism, bioimperialism, and racial superiority. This article explores the complex issues involved in interpreting a game through analysis of the ways modders (gamers who modify the game) have approached the history of science, technology, and knowledge embodied in the game. Through text analysis of modder discussion, this article explores the assumed values and tone of the community’s discourse. The study offers initial findings that CIVILIZATION modders value a variety of positive discursive practices for developing historical models. Community members value a form of historical authenticity, they prize subtlety and nuance in models for science in the game, and they communicate through civil consensus building. Game theorists, players, and scholars, as well as those interested in modeling the history, sociology, and philosophy of science, will be interested to see the ways in which CIVILIZATION III cultivates an audience of modders who spend their time reimagining how science and technology could work in the game.",
				"shortTitle": "Modding the History of Science",
				"title": "Modding the History of Science: Values at Play in Modder Discussions of Sid Meier’s CIVILIZATION",
				"date": "2010-05-27",
				"publicationTitle": "Simulation & Gaming"
			}
		]
	},
	{
		"type": "web",
		"url": "http://bjaesthetics.oxfordjournals.org/search?fulltext=art&submit=yes&x=0&y=0",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://bjaesthetics.oxfordjournals.org/content/current",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://jcb.rupress.org/content/early/by/section",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://rsbl.royalsocietypublishing.org/content/early/recent",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://bloodjournal.hematologylibrary.org/content/early/recent",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://www.pnas.org/content/108/52/20881.full",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Julien",
						"lastName": "Couthouis",
						"creatorType": "author"
					},
					{
						"firstName": "Michael P.",
						"lastName": "Hart",
						"creatorType": "author"
					},
					{
						"firstName": "James",
						"lastName": "Shorter",
						"creatorType": "author"
					},
					{
						"firstName": "Mariely",
						"lastName": "DeJesus-Hernandez",
						"creatorType": "author"
					},
					{
						"firstName": "Renske",
						"lastName": "Erion",
						"creatorType": "author"
					},
					{
						"firstName": "Rachel",
						"lastName": "Oristano",
						"creatorType": "author"
					},
					{
						"firstName": "Annie X.",
						"lastName": "Liu",
						"creatorType": "author"
					},
					{
						"firstName": "Daniel",
						"lastName": "Ramos",
						"creatorType": "author"
					},
					{
						"firstName": "Niti",
						"lastName": "Jethava",
						"creatorType": "author"
					},
					{
						"firstName": "Divya",
						"lastName": "Hosangadi",
						"creatorType": "author"
					},
					{
						"firstName": "James",
						"lastName": "Epstein",
						"creatorType": "author"
					},
					{
						"firstName": "Ashley",
						"lastName": "Chiang",
						"creatorType": "author"
					},
					{
						"firstName": "Zamia",
						"lastName": "Diaz",
						"creatorType": "author"
					},
					{
						"firstName": "Tadashi",
						"lastName": "Nakaya",
						"creatorType": "author"
					},
					{
						"firstName": "Fadia",
						"lastName": "Ibrahim",
						"creatorType": "author"
					},
					{
						"firstName": "Hyung-Jun",
						"lastName": "Kim",
						"creatorType": "author"
					},
					{
						"firstName": "Jennifer A.",
						"lastName": "Solski",
						"creatorType": "author"
					},
					{
						"firstName": "Kelly L.",
						"lastName": "Williams",
						"creatorType": "author"
					},
					{
						"firstName": "Jelena",
						"lastName": "Mojsilovic-Petrovic",
						"creatorType": "author"
					},
					{
						"firstName": "Caroline",
						"lastName": "Ingre",
						"creatorType": "author"
					},
					{
						"firstName": "Kevin",
						"lastName": "Boylan",
						"creatorType": "author"
					},
					{
						"firstName": "Neill R.",
						"lastName": "Graff-Radford",
						"creatorType": "author"
					},
					{
						"firstName": "Dennis W.",
						"lastName": "Dickson",
						"creatorType": "author"
					},
					{
						"firstName": "Dana",
						"lastName": "Clay-Falcone",
						"creatorType": "author"
					},
					{
						"firstName": "Lauren",
						"lastName": "Elman",
						"creatorType": "author"
					},
					{
						"firstName": "Leo",
						"lastName": "McCluskey",
						"creatorType": "author"
					},
					{
						"firstName": "Robert",
						"lastName": "Greene",
						"creatorType": "author"
					},
					{
						"firstName": "Robert G.",
						"lastName": "Kalb",
						"creatorType": "author"
					},
					{
						"firstName": "Virginia M.-Y.",
						"lastName": "Lee",
						"creatorType": "author"
					},
					{
						"firstName": "John Q.",
						"lastName": "Trojanowski",
						"creatorType": "author"
					},
					{
						"firstName": "Albert",
						"lastName": "Ludolph",
						"creatorType": "author"
					},
					{
						"firstName": "Wim",
						"lastName": "Robberecht",
						"creatorType": "author"
					},
					{
						"firstName": "Peter M.",
						"lastName": "Andersen",
						"creatorType": "author"
					},
					{
						"firstName": "Garth A.",
						"lastName": "Nicholson",
						"creatorType": "author"
					},
					{
						"firstName": "Ian P.",
						"lastName": "Blair",
						"creatorType": "author"
					},
					{
						"firstName": "Oliver D.",
						"lastName": "King",
						"creatorType": "author"
					},
					{
						"firstName": "Nancy M.",
						"lastName": "Bonini",
						"creatorType": "author"
					},
					{
						"firstName": "Vivianna Van",
						"lastName": "Deerlin",
						"creatorType": "author"
					},
					{
						"firstName": "Rosa",
						"lastName": "Rademakers",
						"creatorType": "author"
					},
					{
						"firstName": "Zissimos",
						"lastName": "Mourelatos",
						"creatorType": "author"
					},
					{
						"firstName": "Aaron D.",
						"lastName": "Gitler",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot"
					},
					{
						"title": "PubMed entry",
						"mimeType": "text/html",
						"snapshot": false
					}
				],
				"DOI": "10.1073/pnas.1109434108",
				"language": "en",
				"journalAbbreviation": "PNAS",
				"issue": "52",
				"url": "http://www.pnas.org/content/108/52/20881",
				"ISSN": "0027-8424, 1091-6490",
				"extra": "PMID: 22065782",
				"libraryCatalog": "www.pnas.org",
				"abstractNote": "Amyotrophic lateral sclerosis (ALS) is a devastating and universally fatal neurodegenerative disease. Mutations in two related RNA-binding proteins, TDP-43 and FUS, that harbor prion-like domains, cause some forms of ALS. There are at least 213 human proteins harboring RNA recognition motifs, including FUS and TDP-43, raising the possibility that additional RNA-binding proteins might contribute to ALS pathogenesis. We performed a systematic survey of these proteins to find additional candidates similar to TDP-43 and FUS, followed by bioinformatics to predict prion-like domains in a subset of them. We sequenced one of these genes, TAF15, in patients with ALS and identified missense variants, which were absent in a large number of healthy controls. These disease-associated variants of TAF15 caused formation of cytoplasmic foci when expressed in primary cultures of spinal cord neurons. Very similar to TDP-43 and FUS, TAF15 aggregated in vitro and conferred neurodegeneration in Drosophila, with the ALS-linked variants having a more severe effect than wild type. Immunohistochemistry of postmortem spinal cord tissue revealed mislocalization of TAF15 in motor neurons of patients with ALS. We propose that aggregation-prone RNA-binding proteins might contribute very broadly to ALS pathogenesis and the genes identified in our yeast functional screen, coupled with prion-like domain prediction analysis, now provide a powerful resource to facilitate ALS disease gene discovery.",
				"title": "A yeast functional screen predicts new candidate ALS disease genes",
				"date": "12/27/2011",
				"publicationTitle": "Proceedings of the National Academy of Sciences",
				"volume": "108",
				"pages": "20881-20890"
			}
		]
	},
	{
		"type": "web",
		"url": "http://genesdev.cshlp.org/content/16/14/1779",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Makoto",
						"lastName": "Tachibana",
						"creatorType": "author"
					},
					{
						"firstName": "Kenji",
						"lastName": "Sugimoto",
						"creatorType": "author"
					},
					{
						"firstName": "Masami",
						"lastName": "Nozaki",
						"creatorType": "author"
					},
					{
						"firstName": "Jun",
						"lastName": "Ueda",
						"creatorType": "author"
					},
					{
						"firstName": "Tsutomu",
						"lastName": "Ohta",
						"creatorType": "author"
					},
					{
						"firstName": "Misao",
						"lastName": "Ohki",
						"creatorType": "author"
					},
					{
						"firstName": "Mikiko",
						"lastName": "Fukuda",
						"creatorType": "author"
					},
					{
						"firstName": "Naoki",
						"lastName": "Takeda",
						"creatorType": "author"
					},
					{
						"firstName": "Hiroyuki",
						"lastName": "Niida",
						"creatorType": "author"
					},
					{
						"firstName": "Hiroyuki",
						"lastName": "Kato",
						"creatorType": "author"
					},
					{
						"firstName": "Yoichi",
						"lastName": "Shinkai",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Euchromatin",
					"G9a HMTase",
					"heterochromatin",
					"histone H3-K9 methylation",
					"mammalian development",
					"transcriptional regulation"
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot"
					},
					{
						"title": "PubMed entry",
						"mimeType": "text/html",
						"snapshot": false
					}
				],
				"DOI": "10.1101/gad.989402",
				"language": "en",
				"journalAbbreviation": "Genes Dev.",
				"issue": "14",
				"url": "http://genesdev.cshlp.org/content/16/14/1779",
				"abstractNote": "Covalent modification of histone tails is crucial for transcriptional regulation, mitotic chromosomal condensation, and heterochromatin formation. Histone H3 lysine 9 (H3-K9) methylation catalyzed by the Suv39h family proteins is essential for establishing the architecture of pericentric heterochromatin. We recently identified a mammalian histone methyltransferase (HMTase), G9a, which has strong HMTase activity towards H3-K9 in vitro. To investigate the in vivo functions of G9a, we generated G9a-deficient mice and embryonic stem (ES) cells. We found that H3-K9 methylation was drastically decreased in G9a-deficient embryos, which displayed severe growth retardation and early lethality. G9a-deficient ES cells also exhibited reduced H3-K9 methylation compared to wild-type cells, indicating that G9a is a dominant H3-K9 HMTase in vivo. Importantly, the loss of G9a abolished methylated H3-K9 mostly in euchromatic regions. Finally, G9a exerted a transcriptionally suppressive function that depended on its HMTase activity. Our results indicate that euchromatic H3-K9 methylation regulated by G9a is essential for early embryogenesis and is involved in the transcriptional repression of developmental genes.",
				"ISSN": "0890-9369, 1549-5477",
				"extra": "PMID: 12130538",
				"libraryCatalog": "genesdev.cshlp.org",
				"title": "G9a histone methyltransferase plays a dominant role in euchromatic histone H3 lysine 9 methylation and is essential for early embryogenesis",
				"date": "07/15/2002",
				"publicationTitle": "Genes & Development",
				"volume": "16",
				"pages": "1779-1791"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.bjj.boneandjoint.org.uk/content/94-B/1/10.abstract",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "B.",
						"lastName": "Ollivere",
						"creatorType": "author"
					},
					{
						"firstName": "J. A.",
						"lastName": "Wimhurst",
						"creatorType": "author"
					},
					{
						"firstName": "I. M.",
						"lastName": "Clark",
						"creatorType": "author"
					},
					{
						"firstName": "S. T.",
						"lastName": "Donell",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [
					"Arthroplasty",
					"Hip",
					"Knee",
					"Loosening",
					"Osteolysis",
					"Revision"
				],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot"
					},
					{
						"title": "PubMed entry",
						"mimeType": "text/html",
						"snapshot": false
					}
				],
				"DOI": "10.1302/0301-620X.94B1.28047",
				"language": "en",
				"journalAbbreviation": "J Bone Joint Surg Br",
				"issue": "1",
				"url": "http://www.bjj.boneandjoint.org.uk/content/94-B/1/10",
				"ISSN": "2049-4394, 2049-4408",
				"extra": "PMID: 22219240",
				"libraryCatalog": "www.bjj.boneandjoint.org.uk",
				"abstractNote": "The most frequent cause of failure after total hip replacement in all reported arthroplasty registries is peri-prosthetic osteolysis. Osteolysis is an active biological process initiated in response to wear debris. The eventual response to this process is the activation of macrophages and loss of bone.\nActivation of macrophages initiates a complex biological cascade resulting in the final common pathway of an increase in osteolytic activity. The biological initiators, mechanisms for and regulation of this process are beginning to be understood. This article explores current concepts in the causes of, and underlying biological mechanism resulting in peri-prosthetic osteolysis, reviewing the current basic science and clinical literature surrounding the topic.",
				"title": "Current concepts in osteolysis",
				"date": "01/01/2012",
				"publicationTitle": "Journal of Bone & Joint Surgery, British Volume",
				"volume": "94-B",
				"pages": "10-15"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.bjj.boneandjoint.org.uk/content/94-B/1.toc",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://nar.oxfordjournals.org/content/34/suppl_2/W369.full",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Timothy L.",
						"lastName": "Bailey",
						"creatorType": "author"
					},
					{
						"firstName": "Nadya",
						"lastName": "Williams",
						"creatorType": "author"
					},
					{
						"firstName": "Chris",
						"lastName": "Misleh",
						"creatorType": "author"
					},
					{
						"firstName": "Wilfred W.",
						"lastName": "Li",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot"
					},
					{
						"title": "PubMed entry",
						"mimeType": "text/html",
						"snapshot": false
					}
				],
				"DOI": "10.1093/nar/gkl198",
				"language": "en",
				"journalAbbreviation": "Nucl. Acids Res.",
				"issue": "suppl 2",
				"url": "http://nar.oxfordjournals.org/content/34/suppl_2/W369",
				"ISSN": "0305-1048, 1362-4962",
				"extra": "PMID: 16845028",
				"libraryCatalog": "nar.oxfordjournals.org",
				"abstractNote": "MEME (Multiple EM for Motif Elicitation) is one of the most widely used tools for searching for novel ‘signals’ in sets of biological sequences. Applications include the discovery of new transcription factor binding sites and protein domains. MEME works by searching for repeated, ungapped sequence patterns that occur in the DNA or protein sequences provided by the user. Users can perform MEME searches via the web server hosted by the National Biomedical Computation Resource (http://meme.nbcr.net) and several mirror sites. Through the same web server, users can also access the Motif Alignment and Search Tool to search sequence databases for matches to motifs encoded in several popular formats. By clicking on buttons in the MEME output, users can compare the motifs discovered in their input sequences with databases of known motifs, search sequence databases for matches to the motifs and display the motifs in various formats. This article describes the freely accessible web server and its architecture, and discusses ways to use MEME effectively to find new sequence patterns in biological sequences and analyze their significance.",
				"shortTitle": "MEME",
				"title": "MEME: discovering and analyzing DNA and protein sequence motifs",
				"date": "07/01/2006",
				"publicationTitle": "Nucleic Acids Research",
				"volume": "34",
				"pages": "W369-W373"
			}
		]
	},
	{
		"type": "web",
		"url": "http://www.sciencemag.org/content/340/6131/483",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Erica van de",
						"lastName": "Waal",
						"creatorType": "author"
					},
					{
						"firstName": "Christèle",
						"lastName": "Borgeaud",
						"creatorType": "author"
					},
					{
						"firstName": "Andrew",
						"lastName": "Whiten",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot"
					},
					{
						"title": "PubMed entry",
						"mimeType": "text/html",
						"snapshot": false
					}
				],
				"DOI": "10.1126/science.1232769",
				"language": "en",
				"journalAbbreviation": "Science",
				"issue": "6131",
				"url": "http://www.sciencemag.org/content/340/6131/483",
				"ISSN": "0036-8075, 1095-9203",
				"extra": "PMID: 23620053",
				"libraryCatalog": "www.sciencemag.org",
				"abstractNote": "Conformity to local behavioral norms reflects the pervading role of culture in human life. Laboratory experiments have begun to suggest a role for conformity in animal social learning, but evidence from the wild remains circumstantial. Here, we show experimentally that wild vervet monkeys will abandon personal foraging preferences in favor of group norms new to them. Groups first learned to avoid the bitter-tasting alternative of two foods. Presentations of these options untreated months later revealed that all new infants naïve to the foods adopted maternal preferences. Males who migrated between groups where the alternative food was eaten switched to the new local norm. Such powerful effects of social learning represent a more potent force than hitherto recognized in shaping group differences among wild animals.\nAnimal Culture\nCultural transmission of information occurs when individuals learn from others with more experience or when individuals come to accept particular modes of behavior as the local norm. Such information transfer can be expected in highly social or long-lived species where contact and time for learning are maximized and are seen in humans (see the Perspective by de Waal). Using a network-based diffusion analysis on a long-term data set that includes tens of thousands of observations of individual humpback whales, Allen et al. (p. 485) show that an innovative feeding behavior has spread through social transmission since it first emerged in a single individual in 1980. The “lobtail” feeding has passed among associating individuals for more than three decades. Van de Waal et al. (p. 483), on the other hand, used a controlled experimental approach in vervet monkeys to show that individuals learn what to eat from more experienced individuals within their social group. Not only did young animals learn from observing older animals, but immigrating males switched their food preference to that of their new group.",
				"title": "Potent Social Learning and Conformity Shape a Wild Primate’s Foraging Decisions",
				"date": "04/26/2013",
				"publicationTitle": "Science",
				"volume": "340",
				"pages": "483-485"
			}
		]
	},
	{
		"type": "web",
		"url": "http://oss.sagepub.com/search/results?fulltext=labor&x=0&y=0&submit=yes&journal_set=sposs&src=selected&andorexactfulltext=and",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://amj.aom.org/search?tmonth=Dec&pubdate_year=&submit=yes&submit=yes&submit=Submit&andorexacttitle=and&format=standard&firstpage=&fmonth=Jan&title=&hits=50&tyear=2013&titleabstract=&journalcode=amj&journalcode=amr&volume=&sortspec=relevance&andorexacttitleabs=and&author2=&andorexactfulltext=and&fyear=2008&author1=&doi=&fulltext=culture%20cultural&FIRSTINDEX=100",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://ajpheart.physiology.org/content/235/5/H553",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "C. F.",
						"lastName": "Babbs",
						"creatorType": "author"
					},
					{
						"firstName": "S. J.",
						"lastName": "Whistler",
						"creatorType": "author"
					},
					{
						"firstName": "G. K.",
						"lastName": "Yim",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot"
					},
					{
						"title": "PubMed entry",
						"mimeType": "text/html",
						"snapshot": false
					}
				],
				"title": "Temporal stability and precision of ventricular defibrillation threshold data",
				"publicationTitle": "American Journal of Physiology - Heart and Circulatory Physiology",
				"rights": "Copyright © 1978 the American Physiological Society",
				"date": "1978/11/01",
				"url": "http://ajpheart.physiology.org/content/235/5/H553",
				"language": "en",
				"extra": "Over 200 measurements of the minimum damped sinusoidal current and energy for transchest electrical ventricular defibrillation (ventricular defibrillation threshold) were made to determine the stability and precision of threshold data in 15 pentobarbital-anesthetized dogs. Threshold was determined by repeated trials of fibrillation and defibrillation with successive shocks of diminishing current, each 10% less than that of the preceding shock. The lowest shock intensity that defibrillated was defined as threshold. In three groups of five dogs each, threshold was measured at intervals of 60, 15, and 5 min over periods of 8, 5, and 1 h, respectively. Similar results were obtained for all groups. There was no significant change in mean threshold current with time. Owing to a decrease in transchest impedance, threshold delivered energy decreased by 10% during the first hour of testing. The standard deviations for threshold peak current and delivered energy in a given animal were 11% and 22% of their respective mean values. Arterial blood pH, Pco2, and Po2 averaged change of pH, PCO2 and PO2 were not significantly different from zero. The data demonstrate that ventricular defibrillation threshold is a stable physiological parameter that may be measured with reasonable precision.\nPMID: 31797",
				"volume": "235",
				"issue": "5",
				"pages": "H553-H558",
				"libraryCatalog": "ajpheart.physiology.org",
				"abstractNote": "Over 200 measurements of the minimum damped sinusoidal current and energy for transchest electrical ventricular defibrillation (ventricular defibrillation threshold) were made to determine the stability and precision of threshold data in 15 pentobarbital-anesthetized dogs. Threshold was determined by repeated trials of fibrillation and defibrillation with successive shocks of diminishing current, each 10% less than that of the preceding shock. The lowest shock intensity that defibrillated was defined as threshold. In three groups of five dogs each, threshold was measured at intervals of 60, 15, and 5 min over periods of 8, 5, and 1 h, respectively. Similar results were obtained for all groups. There was no significant change in mean threshold current with time. Owing to a decrease in transchest impedance, threshold delivered energy decreased by 10% during the first hour of testing. The standard deviations for threshold peak current and delivered energy in a given animal were 11% and 22% of their respective mean values. Arterial blood pH, Pco2, and Po2 averaged change of pH, PCO2 and PO2 were not significantly different from zero. The data demonstrate that ventricular defibrillation threshold is a stable physiological parameter that may be measured with reasonable precision."
			}
		]
	},
	{
		"type": "web",
		"url": "http://ajpheart.physiology.org/content/235/5",
		"items": "multiple"
	},
	{
		"type": "web",
		"url": "http://nar.oxfordjournals.org/content/41/D1/D94.long",
		"items": [
			{
				"itemType": "journalArticle",
				"creators": [
					{
						"firstName": "Regina Z.",
						"lastName": "Cer",
						"creatorType": "author"
					},
					{
						"firstName": "Duncan E.",
						"lastName": "Donohue",
						"creatorType": "author"
					},
					{
						"firstName": "Uma S.",
						"lastName": "Mudunuri",
						"creatorType": "author"
					},
					{
						"firstName": "Nuri A.",
						"lastName": "Temiz",
						"creatorType": "author"
					},
					{
						"firstName": "Michael A.",
						"lastName": "Loss",
						"creatorType": "author"
					},
					{
						"firstName": "Nathan J.",
						"lastName": "Starner",
						"creatorType": "author"
					},
					{
						"firstName": "Goran N.",
						"lastName": "Halusa",
						"creatorType": "author"
					},
					{
						"firstName": "Natalia",
						"lastName": "Volfovsky",
						"creatorType": "author"
					},
					{
						"firstName": "Ming",
						"lastName": "Yi",
						"creatorType": "author"
					},
					{
						"firstName": "Brian T.",
						"lastName": "Luke",
						"creatorType": "author"
					},
					{
						"firstName": "Albino",
						"lastName": "Bacolla",
						"creatorType": "author"
					},
					{
						"firstName": "Jack R.",
						"lastName": "Collins",
						"creatorType": "author"
					},
					{
						"firstName": "Robert M.",
						"lastName": "Stephens",
						"creatorType": "author"
					}
				],
				"notes": [],
				"tags": [],
				"seeAlso": [],
				"attachments": [
					{
						"title": "Full Text PDF",
						"mimeType": "application/pdf"
					},
					{
						"title": "Snapshot"
					},
					{
						"title": "PubMed entry",
						"mimeType": "text/html",
						"snapshot": false
					}
				],
				"DOI": "10.1093/nar/gks955",
				"language": "en",
				"journalAbbreviation": "Nucl. Acids Res.",
				"issue": "D1",
				"url": "http://nar.oxfordjournals.org/content/41/D1/D94",
				"ISSN": "0305-1048, 1362-4962",
				"extra": "PMID: 23125372",
				"libraryCatalog": "nar.oxfordjournals.org",
				"abstractNote": "The non-B DB, available at http://nonb.abcc.ncifcrf.gov, catalogs predicted non-B DNA-forming sequence motifs, including Z-DNA, G-quadruplex, A-phased repeats, inverted repeats, mirror repeats, direct repeats and their corresponding subsets: cruciforms, triplexes and slipped structures, in several genomes. Version 2.0 of the database revises and re-implements the motif discovery algorithms to better align with accepted definitions and thresholds for motifs, expands the non-B DNA-forming motifs coverage by including short tandem repeats and adds key visualization tools to compare motif locations relative to other genomic annotations. Non-B DB v2.0 extends the ability for comparative genomics by including re-annotation of the five organisms reported in non-B DB v1.0, human, chimpanzee, dog, macaque and mouse, and adds seven additional organisms: orangutan, rat, cow, pig, horse, platypus and Arabidopsis thaliana. Additionally, the non-B DB v2.0 provides an overall improved graphical user interface and faster query performance.",
				"shortTitle": "Non-B DB v2.0",
				"title": "Non-B DB v2.0: a database of predicted non-B DNA-forming motifs and its associated tools",
				"date": "01/01/2013",
				"publicationTitle": "Nucleic Acids Research",
				"volume": "41",
				"pages": "D94-D100"
			}
		]
	},
	{
		"type": "web",
		"url": "http://bloodjournal.hematologylibrary.org/content/123/22",
		"items": "multiple"
	}
]
/** END TEST CASES **/