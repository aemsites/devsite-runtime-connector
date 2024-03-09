---
title: Manage company users
description: Manage which companies a user belongs to
edition: ee
keywords:
  - B2B
  - REST
---

import * as Vars from '../../../data/vars.js';

# Manage company users

A company user is a customer (buyer) that is assigned extended attributes that identify the company the user belongs to. Use the `POST /V1/customers` call, which is included with <Vars.sitedatavarce/> and <Vars.sitedatavaree/>, to create the user. After the user is created, you can use the `PUT /V1/customers/:customer_id` call to set their company data with the `company_attributes` extended attributes.

<InlineAlert variant="info" slots="text"/>

This topic discusses only the features of the `customerCustomerRepositoryV1` service that are specific to B2B. See [Create a customer](../tutorials/orders/order-create-customer.md) for an example of creating a standard customer.
