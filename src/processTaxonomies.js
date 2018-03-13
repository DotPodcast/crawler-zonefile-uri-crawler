const TAXONOMY_BASE_LENGTH = 33;

const processTaxonomies = (data) => {
  if(data.taxonomy_terms) {
    const hierarchy = [];
    const taxSet = {};
    data.taxonomy_terms.forEach((term) => {
      //https://dotpodcast.co/taxonomies/language/#en
      const parts = term.substring(TAXONOMY_BASE_LENGTH).split('/');
      const parent = parts[0];
      const child = parts[1].substring(1);
      if(taxSet[parent]) {
        taxSet[parent].push(child);
      } else {
        taxSet[parent] = [child];
      }
    });

    for(let key in taxSet) {
      hierarchy.push({level: 1, value: key, ancestors: []});

      taxSet[key].forEach((child) => {
        hierarchy.push({level: 2, value: child, ancestors: [key]});
      });
    }
    return hierarchy;
  }
};

export default processTaxonomies;
