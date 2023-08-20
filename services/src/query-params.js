function parse(url) {
  const string = decodeURIComponent(url)
  const results = string.match(/\?(?<query>.*)/);
  if (!results) {
    return {};
  }

  const { groups: { query } } = results;

  const pairs = query.match(/(?<param>\w+)=(?<value>[^&]+)/g);
  if(!pairs) return {}
  const params = pairs.reduce((acc, curr) => {
    const [key, value] = curr.split(("="));
    acc[key] = value;
    return acc;
  }, {});
  return params;
}

module.exports = parse;