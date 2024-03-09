**Company user parameters:**

The following table lists the parameters that can be used to set company data for a user.

Name | Description | Format | Requirements
--- | --- | --- | ---
`customer_id` | System-generated customer ID. | integer | Not applicable for create operations.
`company_id` | System-generated company ID. | integer | Required to create or update a company user.
`job_title` | A string that describes the company user's responsibilities. | string | Required to create or update a company.
`status` | Indicates whether the company user is active or inactive | integer | `0` - inactive; `1` - active
`telephone`  |  Telephone number | string | Required to create a company user.
