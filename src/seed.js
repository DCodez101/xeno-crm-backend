require('dotenv').config();
const mongoose = require('mongoose');
const Customer = require('./models/Customer');
const Order = require('./models/Order');

const CITIES = ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat'];
const TAGS = ['vip', 'new', 'loyal', 'at-risk', 'high-value', 'discount-seeker', 'seasonal'];
const CATEGORIES = ['Kurtas', 'Sarees', 'Dresses', 'Tops', 'Jeans', 'Ethnic Sets', 'Accessories', 'Footwear'];
const CHANNELS = ['online', 'store', 'app'];

const FIRST_NAMES = ['Priya', 'Neha', 'Anjali', 'Sneha', 'Pooja', 'Kavya', 'Divya', 'Meera', 'Ritu', 'Sunita',
  'Rahul', 'Amit', 'Vikram', 'Arjun', 'Rohit', 'Karan', 'Nikhil', 'Siddharth', 'Aakash', 'Manish'];
const LAST_NAMES = ['Sharma', 'Verma', 'Patel', 'Gupta', 'Singh', 'Kumar', 'Joshi', 'Mehta', 'Shah', 'Nair',
  'Reddy', 'Rao', 'Iyer', 'Pillai', 'Menon', 'Chatterjee', 'Mukherjee', 'Das', 'Bose', 'Ghosh'];

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(n) { return new Date(Date.now() - n * 24 * 60 * 60 * 1000); }

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected. Clearing existing data...');
  await Customer.deleteMany({});
  await Order.deleteMany({});

  const customers = [];
  for (let i = 0; i < 200; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@gmail.com`;
    const phone = `+91${rand(7000000000, 9999999999)}`;
    const city = pick(CITIES);
    const numTags = rand(0, 2);
    const tags = [...new Set(Array.from({ length: numTags }, () => pick(TAGS)))];

    customers.push({ name, email, phone, city, tags, totalSpend: 0, orderCount: 0 });
  }

  const savedCustomers = await Customer.insertMany(customers);
  console.log(`Inserted ${savedCustomers.length} customers`);

  const orders = [];
  for (const customer of savedCustomers) {
    const numOrders = rand(1, 8);
    let totalSpend = 0;
    let lastOrderAt = null;

    for (let j = 0; j < numOrders; j++) {
      const orderDaysAgo = rand(1, 365);
      const orderDate = daysAgo(orderDaysAgo);
      const numItems = rand(1, 4);
      const items = Array.from({ length: numItems }, () => ({
        name: `${pick(CATEGORIES)} - ${pick(['Classic', 'Premium', 'Festive', 'Casual'])}`,
        category: pick(CATEGORIES),
        quantity: rand(1, 3),
        price: rand(499, 4999)
      }));
      const amount = items.reduce((s, item) => s + item.price * item.quantity, 0);
      totalSpend += amount;
      if (!lastOrderAt || orderDate > lastOrderAt) lastOrderAt = orderDate;

      orders.push({
        customerId: customer._id,
        amount,
        items,
        channel: pick(CHANNELS),
        status: Math.random() > 0.1 ? 'completed' : 'returned',
        createdAt: orderDate
      });
    }

    await Customer.findByIdAndUpdate(customer._id, {
      totalSpend: Math.round(totalSpend),
      orderCount: numOrders,
      lastOrderAt
    });
  }

  await Order.insertMany(orders);
  console.log(`Inserted ${orders.length} orders`);
  console.log('Seed complete ✓');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
