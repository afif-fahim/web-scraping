const axios = require("axios");
const cheerio = require("cheerio");
const json2csvParser = require("json2csv").Parser;
const fs = require("fs");


let pageNo = 1;
const initialUrl = 'https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz/q-actros?search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at%3Adesc';
const ads = [];
const truckData = [];

const scrapeTruckItem = async () => {
    let adsLength = ads.length;
    for (let index = 0; index < adsLength; index++) {
        const ad = ads[index];
        console.log(`Scraping ad ${index + 1}`);

        try {
            const { data } = await axios.get(ad.url);
            const $ = cheerio.load(data);

            let title = $("span.offer-title").text().trim();
            let price = $(".price-wrapper div.offer-price").attr("data-price");
            let currency = $(".price-wrapper .offer-price__currency").text();
            price = `${price.split(' ').join('')} ${currency}`
            
            let details = $(".offer-params__item");
            let productionDate = '';
            let registrationDate = '';
            let mileage = '';
            let power = '';
            
            details.each(function() {
                if ($(this).find("span").text().trim() === "Rok produkcji") // production
                    productionDate = $(this).find("div").text().trim();
                if ($(this).find("span").text().trim() === "Pierwsza rejestracja") // registration
                    registrationDate = $(this).find("div").text().trim();
                if ($(this).find("span").text().trim() === "Przebieg") // mileage
                    mileage = $(this).find("div").text().trim();
                if ($(this).find("span").text().trim() === "Moc") // power
                    power = $(this).find("div").text().trim();
            });

            truckData.push({
                'item id': ad.id,
                title,
                price,
                'registration date': registrationDate,
                'production date': productionDate,
                mileage,
                power,
            });
        } catch (error) {
            console.error(error);
        }
    }
}

const addItems = async ($) => {
    const adsData = $("article[data-testid='listing-ad']");

    adsData.each(function() {
       id = $(this).attr("id");
       url = $(this).find("div h2 a").attr("href");

       ads.push({ id, url });
    });
}

const getTotalAdsCount = async ($) => {
    const adsCount = $("article[data-testid='listing-ad']").length;
    return adsCount;
}

const getNextPageUrl = async ($) => {
    const nextPageDisabled = $("li[data-testid='pagination-step-forwards']").attr("aria-disabled");
    if(nextPageDisabled === 'true') return null;

    pageNo += 1;
    return `${initialUrl}&page=${pageNo}`;
}


const scrape = async (initialUrl) => {
    try {
        const { data } = await axios.get(initialUrl);
        const $ = cheerio.load(data);

        const totalAdsCount = await getTotalAdsCount($);
        console.log(`Page ${pageNo}: Total ads ${totalAdsCount}`);

        await addItems($);

        const nextPageUrl = await getNextPageUrl($);

        if (nextPageUrl) scrape(nextPageUrl);
        else {
            console.log(`Total ad items ${ads.length}`);

            await scrapeTruckItem();
            const parser = new json2csvParser();
            const csv = parser.parse(truckData);
            fs.writeFileSync("./trucks.csv", csv);
        }
    } catch (error) {
        console.error(error);
    }
}

scrape(initialUrl);