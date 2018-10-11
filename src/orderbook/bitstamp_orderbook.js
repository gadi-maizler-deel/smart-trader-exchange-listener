import Pusher from 'pusher-js';
import orderbook_manager from 'orderbook/orderbook_manager';
const pusher = new Pusher('de504dc5763aeef9ff52');
const external_pairs = { 'BTC-USD': '', 'BCH-USD': '_bchusd' };
const bitstamp_pairs = { '_btcusd': 'BTC-USD', '_bch_usd': 'BCH-USD' };

class bitstamp_orderbook {
  constructor(orderbook_listener, asset_pairs) {
    this.reset_timestamp = 0;
    this.required_pairs = asset_pairs;
    this.orderbook_channels = {};
    // this.ordersChannel = pusher.subscribe('live_orders');
    // this.orderBookChannel = pusher.subscribe('order_book_bchusd');
    // this.orderDiffBookChannel = pusher.subscribe('diff_order_book');
    this.orderbook_manager = new orderbook_manager(orderbook_listener, 'Bitstamp', asset_pairs);
  }

  normalize_order(data) {
    let new_order = {
      price: data.price, size: data.amount,
      type: data.order_type == 0 ? 'bids' : 'asks',
      exchange_id: data.id.toString(),
      source: 'Bitstamp'
    };
    return new_order;
  }

  normalize_orderbook_order(order, type) {

    return {
      price: parseFloat(order[0]), size: parseFloat(order[1]), type: type,
      exchange_id: order.length > 2 ? order[2] : null, source: 'Bitstamp'
    };
  }

  bind_channel(channel_name, cb) {
    this.ordersChannel.bind(channel_name, function (data) {
      cb(channel_name, data);
    });
  }

  order_callback(channel_name, order) {
    // console.log(channel_name, order);
  }

  bind_all_channels() {
    for(let i = 0 ; i < this.required_pairs.length ; i++) {
      let required_pair = this.required_pairs[i];
      let bitstamp_pair = external_pairs[required_pair];
      if(bitstamp_pair !== null) {
        this.orderbook_channels[required_pair] = pusher.subscribe('order_book' + bitstamp_pair);
      }
    }

    const orderbook = this.orderbook_manager;
    const normalize = this.normalize_order;

    const available_channels = Object.keys(this.orderbook_channels);
    for(let i = 0 ; i < available_channels.length ; i++) {
      let asset_pair = available_channels[i];
      this.orderbook_channels[asset_pair].bind('data', data => {
        const order_types = ['asks', 'bids'];
        for (let curr_type_index in order_types) {
          for (let order_index in data[order_types[curr_type_index]]) {
            this.orderbook_manager.add_order(
              this.normalize_orderbook_order(data[order_types[curr_type_index]][order_index],
                order_types[curr_type_index]), asset_pair);
          }
        }
        this.orderbook_manager.notify_orderbook_changed();
      });
    }
    /* this.ordersChannel.bind('order_created', function (data) {
        //if (parseInt(data.datetime) > this.reset_timestamp)
        {
            console.log(new Date().getTime(), 'order added', JSON.stringify(data));
            orderbook.add_order(normalize(data));
        }

    });
    this.ordersChannel.bind('order_deleted', function (data) {
        //if (parseInt(data.datetime) > this.reset_timestamp)
        {
            console.log(new Date().getTime(), 'order deleted', JSON.stringify(data));
            orderbook.delete_order(normalize(data));
        }
    });
    this.ordersChannel.bind('order_changed', function (data) {
        //if (parseInt(data.datetime) > this.reset_timestamp)
        {
            console.log(new Date().getTime(), 'order changed', JSON.stringify(data));
            orderbook.change_order(normalize(data));
        }
    });*/
    /* this.orderDiffBookChannel.bind('data', data =>
    {
        //console.log(new Date().getTime(), 'orderbook diff', data);
    })*/
  }

  reset_orderbook(bitstamp_orderbook_instance) {
    const url = 'https://www.bitstamp.net/api/v2/order_book/btcusd/?group=2';
    let orderbook_manager = bitstamp_orderbook_instance.orderbook_manager;
    const get_orderbook = async url => {
      try {
        const response = await fetch(url);
        const orderbook = await response.json();
        bitstamp_orderbook_instance.reset_timestamp = orderbook.timestamp;
        orderbook_manager.clear_orderbook(this.required_pairs);
        let order_types = ['bids', 'asks'];
        for (let type_index in order_types) {
          let orderbook_counter = 0;
          for (let curr_bid in orderbook[order_types[type_index]]) {
            orderbook_counter++;
            orderbook_manager.add_order(bitstamp_orderbook_instance.normalize_orderbook_order(
              orderbook[order_types[type_index]][curr_bid],
              order_types[type_index]));
            if (orderbook_counter > 9) {
              break;
            }
          }
        }
      }
      catch (error) {
        console.log(error);
      }
    };
    get_orderbook(url);
  }

  print_orderbook(orderbook) {
    console.log('Printing asks:');
    let asks = orderbook.orderbook_manager.get_orderbook().asks;
    let iterator = asks.iterate();
    let curr = iterator.next();
    while (!curr.done) {
      console.log('ask', curr.value.key, curr.value.value.size);
      curr = iterator.next();
    }
    console.log('Printing bids:');
    let bids = orderbook.orderbook_manager.get_orderbook().bids;
    iterator = bids.iterate();
    curr = iterator.next();
    while (!curr.done) {
      console.log('bid', curr.value.key, curr.value.value.size);
      curr = iterator.next();
    }
  }
}

export default bitstamp_orderbook;