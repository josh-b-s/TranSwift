/** Turns a router rejection (e.g. "Error: RouterError.NoServiceFound") into text a rider can act on. */
export function routeErrorMessage(error: string): string {
    if (error.includes('NoServiceFound')) {
        return 'No services run near this time. Try a different departure time.';
    }
    if (error.includes('NoRoute')) {
        return 'No transit route found between these points.';
    }
    return error;
}
