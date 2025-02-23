const cscServices = require('csc-services');
const OrdersService = cscServices.OrderService;
const { Topics } = cscServices.constants;
const { orderStatusesEnum, orderTableHeaders } = cscServices.constants.order;
const eventBusService = cscServices.EventBusService;
const momentService = cscServices.momentService;
// eslint-disable-next-line no-undef
const { WebcController } = WebCardinal.controllers;

export default class OrdersController extends WebcController {
  statusesArray = Object.entries(orderStatusesEnum).map(([k, v]) => v);
  itemsPerPageArray = [5, 10, 15, 20, 30];

  headers = orderTableHeaders;

  search = {
    label: 'Search for an order',
    required: false,
    placeholder: 'Order name...',
    value: '',
  };

  orders = null;

  pagination = {
    previous: false,
    next: false,
    items: null,
    pages: {
      selectOptions: '',
    },
    slicedPages: null,
    currentPage: 0,
    itemsPerPage: 10,
    totalPages: null,
    itemsPerPageOptions: {
      selectOptions: this.itemsPerPageArray.join(' | '),
      value: this.itemsPerPageArray[1].toString(),
    },
  };

  constructor(...props) {
    super(...props);

    this.ordersService = new OrdersService(this.DSUStorage);
    this.feedbackEmitter = null;

    this.model = {
      statuses: this.statuses,
      filter: '',
      search: this.search,
      orders: [],
      pagination: this.pagination,
      headers: this.headers,
      type: 'orders',
      clearButtonDisabled: true,
      tableLength: this.headers.length,
    };

    this.attachEvents();

    this.init();
  }

  async init() {
    await this.getOrders();
    eventBusService.addEventListener(Topics.RefreshOrders, async (data) => {
      this.getOrders();
    });
  }

  async getOrders() {
    try {
      const ordersTemp = await this.ordersService.getOrders();
      this.orders = this.transformData(ordersTemp);
      this.setOrdersModel(this.orders);
    } catch (error) {
      console.log(error);
      this.showFeedbackToast('ERROR: There was an issue accessing orders object', 'Result', 'toast');
    }
  }

  transformData(data) {
    if (data) {
      data.forEach((item) => {
        item.requestDate_value = momentService(item.requestDate).format('MM/DD/YYYY HH:mm:ss');

        item.lastModified_value = momentService(item.lastModified).format('MM/DD/YYYY HH:mm:ss');

        const latestStatus = item.status.sort(function (a, b) {
          return new Date(b.date) - new Date(a.date);
        })[0];
        item.status_value = latestStatus.status;
        item.status_date = momentService(latestStatus.date).format('MM/DD/YYYY HH:mm:ss');
      });
    }
    return data;
  }

  setOrdersModel(orders) {
    this.model.orders = orders;
    this.model.data = orders;
    this.model.headers = this.model.headers.map((x) => ({ ...x, asc: false, desc: false }));
  }

  filterData() {
    let result = this.orders;

    if (this.model.filter) {
      result = result.filter((x) => x.status_value === orderStatusesEnum[this.model.filter]);
    }
    if (this.model.search.value && this.model.search.value !== '') {
      result = result.filter((x) => x.orderId.toUpperCase().search(this.model.search.value.toUpperCase()) !== -1);
    }

    this.setOrdersModel(result);
  }

  showFeedbackToast(title, message, alertType) {
    if (typeof this.feedbackEmitter === 'function') {
      this.feedbackEmitter(message, title, alertType);
    }
  }

  attachEvents() {
    this.model.addExpression('ordersArrayNotEmpty', () => this.model.orders && Array.isArray(this.model.orders) && this.model.orders.length > 0, 'orders');

    this.on('openFeedback', (e) => {
      this.feedbackEmitter = e.detail;
    });

    this.on('run-filters', (e) => {
      this.filterData();
    });

    this.on('view-order', async (event) => {
      this.navigateToPageTag('order', {
        id: event.data,
        keySSI: this.orders.find((x) => x.orderId === event.data).orderSSI,
        documentsKeySSI: this.orders.find((x) => x.orderId === event.data).documentsKeySSI,
      });
    });

    this.onTagClick('filters-changed', async (model, target, event) => {
      const selectedFilter = target.getAttribute('data-custom') || null;
      if (selectedFilter) {
        document.getElementById(`filter-${this.model.filter}`).classList.remove('selected');
        this.model.filter = selectedFilter;
        document.getElementById(`filter-${this.model.filter}`).classList.add('selected');
        this.model.clearButtonDisabled = false;
        this.filterData();
      }
    });

    this.onTagClick('filters-cleared', async (event) => {
      document.getElementById(`filter-${this.model.filter}`).classList.remove('selected');
      this.model.filter = '';
      document.getElementById(`filter-${this.model.filter}`).classList.add('selected');
      this.model.clearButtonDisabled = true;
      this.model.search.value = null;
      this.filterData();
    });

    const searchField = this.element.querySelector('#search-field');
    searchField.addEventListener('keydown', () => {
      setTimeout(() => {
        this.model.clearButtonDisabled = false;
        this.filterData();
      }, 300);
    });
  }
}
