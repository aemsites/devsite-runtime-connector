export interface OWParams {
  /**
   * the HTTP method of the request
   */
  __ow_method: string;
  /**
   * the request headers
   */
  __ow_headers: Record<string, string>;
  /**
   * the unmatched path of the request (matching stops after consuming the action extension)
   */
  __ow_path: string;
  /**
   * the request body entity, as a base64 - encoded string when its content is binary 
   * or JSON object / array, or as a plain string otherwise
   */
  __ow_body: string;
  /**
   * the query parameters from the request as an unparsed string
   */
  __ow_query: string;
}

export interface OWResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: Record<string, unknown> | string;
}

export interface OWEnv {
  /**
   * the name of the action
   */
  __OW_ACTION_NAME: string;
  /**
   * the internal revision of the action (developers cann't affect this)
   */
  __OW_ACTION_VERSION: string;
  /**
   * the activation ID
   */
  __OW_ACTIVATION_ID: string;
  /**
   * indicates the runtime should support concurrency(should always be true for nodejs actions)
   */
  __OW_ALLOW_CONCURRENT: string;
  /**
   * the host used for making additional OpenWhisk API requests within the action(e.g.using OpenWhisk JavaScript SDK)
   */
  __OW_API_HOST: string;
  /**
   *  AWS vs Azure
   */
  __OW_CLOUD: string;
  /**
   * the namespace of the invocation client
   */
  __OW_NAMESPACE: string;
  /**
   * AWS / Azure region where the action was executed
   */
  __OW_REGION: string;
  /**
   * request ID sent with OW API request, or generated; see response header X - Request - Id
   */
  __OW_TRANSACTION_ID: string;
}