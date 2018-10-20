$(function(){

  String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
  };

  const base = "https://www.arabam.com/";

  const slugify = text => {
      var trMap = {
          'çÇ':'c',
          'ğĞ':'g',
          'şŞ':'s',
          'üÜ':'u',
          'ıİ':'i',
          'öÖ':'o'
      };
      for(var key in trMap) {
          text = text.replace(new RegExp('['+key+']','g'), trMap[key]);
      }
      return  text.replace(/[^-a-zA-Z0-9\s]+/ig, '') // remove non-alphanumeric chars
                  .replace(/\s/gi, "-") // convert spaces to dashes
                  .replace(/[-]+/gi, "-") // trim repeated dashes
                  .toLowerCase();

  }

  const get = url => {
    return $.get(`${base}${url}`, {}, (res) => res);
  }

  const getCategories = async () => {
    let categories = {};

    let page = await get("sifir-km");

    $(page).find(".brand-flex-wrapper a").each(function(){
      let item = $(this),
          brandName = item.find(".brand-name").text().trim(),
          brandLink = item.attr("href");

      categories[slugify(brandName)] = { brandName, brandLink };
    });

    return categories;
  }

  const getSubCategories = async categories => {

    for (var index in categories) {
      let item = categories[index];

      let page = await get(item.brandLink);

      categories[index]["sub_categories"] = {};

      $(page).find(".category-facet-selection-item:not(.__root,.selected) a").each(function(){
        let item = $(this),
            modelName = item.text().trim(),
            modelLink = item.attr("href");

        categories[index]["sub_categories"][slugify(modelName)] = { modelName, modelLink };
      });
    }

    return categories;
  }

  const getVehicles = async categories => {

    let vehicles = {};

    for (var index in categories) {
      for (var subIndex in categories[index]["sub_categories"]) {
        let subItem = categories[index]["sub_categories"][subIndex];

        let page = await get(subItem.modelLink);

        setLoader(35, subItem.modelName + " kategorisinden " + $(page).find("#sifir-km-search-index-main-listing a").length + " araç");

        $(page).find("#sifir-km-search-index-main-listing a").each(async function() {
          let item = $(this),
              vehicleLink = item.attr("href"),
              vehicleTitle = item.find("h2.title").text();

          let vehiclePage = await get(vehicleLink);

          $(vehiclePage).find("#sifir-km-model-package-wrapper h3").each(async function(){
            let _packageItem = $(this);

            await $(this).find(" + table tbody a.detail-link").each(async function(){
              let packageItemLink = $(this).attr("href"),
                  packageItemPage = await get(packageItemLink),
                  packageItem = {
                    link: packageItemLink,
                    category: subIndex,
                    images: {},
                    specificProps: {},
                    informations: {},
                    equipments: {},
                  };

              packageItemPage = $(packageItemPage);

              packageItem.title = packageItemPage.find(".meta h1").text();
              packageItem.price = packageItemPage.find(".price-and-contact-wrapper .price").text().replace(" TL","").replace(".", "");

              packageItemPage.find(".small-photo img").each(function(i){
                packageItem.images[i] = $(this).attr("src");
              });

              packageItemPage.find(".specs-table tbody tr").each(function(){
                packageItem.specificProps[slugify($(this).find("td:first-of-type").text())] = {
                  title: $(this).find("td:first-of-type").text(),
                  value: $(this).find("td:last-of-type").text()
                };
              });

              packageItemPage.find(".tab-content-wrapper #information h3").each(function(){
                let slug = slugify($(this).text());
                packageItem.informations[slug] = {};

                $(this).find("+ .section-content .section-row").each(function(i){
                  let title = $(this).find(".label").text(),
                      value = $(this).find(".value").text();

                  packageItem.informations[slug][slugify(title)] = {
                    title: title,
                    value: value,
                  };
                });
              });

              packageItemPage.find(".tab-content-wrapper #equipments h3").each(function(){
                let slug = slugify($(this).text());
                packageItem.equipments[slug] = {};

                $(this).find("+ .section-content .section-row").each(function(i){
                  let title = $(this).find(".label").text(),
                      value = $(this).find(".value").text();

                  packageItem.equipments[slug][slugify(title)] = {
                    title: title,
                    value: value,
                  };
                });
              });

              vehicles[slugify(packageItem.title)] = packageItem;
            });
          })
        });
      }
    }

    return vehicles;
  }

  const getDate = () => {
    let date = new Date(),
        addZero = (str) => str.toString().length == 1 ? "0" + str : str;

    return date.getFullYear() + "-" +
           addZero(date.getMonth()) + "-" +
           addZero(date.getDay()) + " " +
           addZero(date.getHours()) + ":" +
           addZero(date.getMinutes()) + ":" +
           addZero(date.getSeconds());
  }

  const objectToString = obj => {
    string = JSON.stringify(obj);
    string = string.replaceAll('"', "'");

    return string;
  }

  const createQuery = (categories, vehicles) => {

    let queries = "";

    for (var index in categories) {
      let category = categories[index],
          date = getDate();

      queries += 'INSERT INTO `vehicle_category`( `sub`, `slug`, `title`, `updated_at`, `created_at`) VALUES ("","' + index + '","' + category.brandName + '","' + date + '","' + date + '");\r\n';

      for (var subIndex in categories[index]["sub_categories"]) {
        let subItem = categories[index]["sub_categories"][subIndex],
            date = getDate();

        queries += 'INSERT INTO `vehicle_category`( `sub`, `slug`, `title`, `updated_at`, `created_at`) VALUES ("' + index + '","' + subIndex + '","' + subItem.modelName + '","' + date + '","' + date + '");\r\n';
      }
    }

    let i = 0;
    for (var index in vehicles) {
      let vehicle = vehicles[index],
          date = getDate();
          images = objectToString(vehicle.images),
          informations = objectToString(vehicle.informations),
          equipments = objectToString(vehicle.equipments),

          caseType = vehicle.specificProps["kasa-tipi"].value,
          tierType = vehicle.specificProps["vites-tipi"].value,
          fuelType = vehicle.specificProps["yakit-tipi"].value,
          fuelConsumption = vehicle.specificProps["yakit-tuketimi"].value.replace(" Lt", "").replace(",", "."),
          horsePower = vehicle.specificProps["motor-gucu"].value,
          engineCapacity = vehicle.specificProps["motor-hacmi"].value;

      queries += 'INSERT INTO `vehicles` ( `slug`, `title`, `link`, `category`, `images`, `caseType`, `tierType`, `fuelType`, `fuelConsumption`, `horsePower`, `engineCapacity`, `informations`, `equipments`, `price`, `video`, `view`, `updated_at`, `created_at`) VALUES ' +
                                       ' ("' + index + '","' + vehicle.title + '","' + vehicle.link + '","' + vehicle.category + '","' + images + '","' + caseType + '","' + tierType + '","' + fuelType + '","' + fuelConsumption + '","' + horsePower + '","' + engineCapacity + '","' + informations + '","' + equipments + '","' + vehicle.price + '","",0,"' + date + '","' + date + '");\r\n';
    }

    return queries;
  }

  const setLoader = (rate, status) => {
    $('.progress-bar').width(rate + "%").html(rate + "%");

    if (status) $('span.status').html(status);
  }

  const start = async () => {

    setLoader(0, "Kategoriler alınıyor");

    if (typeof localStorage["categories"] == "undefined") {
      categories = await getCategories();
      setLoader(15, "Alt kategoriler alınıyor");
      categories = await getSubCategories(categories);

      localStorage["categories"] = JSON.stringify(categories);
    } else {
      categories = JSON.parse(localStorage["categories"]);
    }
    setLoader(30, "Araçlar senkronize ediliyor");

    if (typeof localStorage["vehicles"] == "undefined") {
      let vehicles = await getVehicles(categories);

      localStorage["vehicles"] = JSON.stringify(vehicles);
    } else {
      vehicles = JSON.parse(localStorage["vehicles"]);
    }

    setLoader(100, "Tüm işlemler tamamlandı");

    queries = createQuery(categories, vehicles);

    $(".result-area").html(queries);
  }

  $("#start").click(start);

});
