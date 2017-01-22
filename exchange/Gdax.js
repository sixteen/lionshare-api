import WebSocket             from 'websocket';
import ReconnectingWebsocket from 'reconnecting-websocket';
import EventEmitter          from 'events';

import ApiClient                from './ApiClient';
import { convertPeriod, sleep } from '../utils/period';

const CRYPTO_CURRENCY_PAIRS = [
  'BTC-USD', // Bitcoin
  'ETH-USD', // Ethereum
  'LTC-USD', // Litecoin
];

const BASE_URL = 'https://api.gdax.com';
const WS_URL   = 'wss://ws-feed.gdax.com';

class Gdax extends EventEmitter {
  constructor() {
    super();
    this.apiClient = new ApiClient({ baseUrl: BASE_URL });
  }

  connect = () => {
    const options = {
      constructor: WebSocket.w3cwebsocket
    };
    this.websocket = new ReconnectingWebsocket(WS_URL, null, options);

    this.websocket.addEventListener('open', () => {
      this.websocket.send(JSON.stringify({
        type: 'subscribe',
        product_ids: CRYPTO_CURRENCY_PAIRS
      }));
    });

    this.websocket.addEventListener('message', (message) => {
      const data = JSON.parse(message.data);
      if (data.type === 'match') {
        const cryptoCurrency = data.product_id.split('-')[0];
        const price = parseFloat(data.price);

        this.emit('message', {
          cryptoCurrency,
          price
        });
      }
    });
  }

  getPrices = async (period) => {
    let rates = {};
    let { start, end, granularity } = convertPeriod(period, 'gdax');

    start = start.toISOString();
    end = end.toISOString();

    for (let pair of CRYPTO_CURRENCY_PAIRS) {
      const cryptoCurrency = pair.split('-')[0];
      const cryptoRates = [];

      const data = await this.apiClient.get(`/products/${pair}/candles`, {
        start,
        end,
        granularity
      });

      for (let rate of data) {
        // Record the closing price for each interval
        cryptoRates.unshift(parseFloat(rate[4]));
      }
      rates[cryptoCurrency] = cryptoRates;
      // Wait for 1s to avoid getting rate limited
      await sleep(1000);
    }

    return rates;

  }
}
export default Gdax;
